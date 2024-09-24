import os
import pandas as pd
from flask import Blueprint, jsonify, request, current_app
from dotenv import load_dotenv
from .db import fetch_transactions, fetch_chart_data, load_csv_data, get_ordered_labels_as_dataframe, fetch_all_transactions, update_transaction_label, fetch_transactions_by_label_and_month, update_label_order, add_category_to_db, add_label_to_db
import logging


bp = Blueprint('main', __name__)


# Configure logging
logging.basicConfig(level=logging.INFO)

@bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    month = request.args.get('month')
    try:
        if month:
            transactions = fetch_transactions(month_start=month)
        else:
            transactions = fetch_transactions()
        return jsonify(transactions)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/hello', methods=['GET'])
def example_route():
    return jsonify({"message": "Hello, World!"}), 200

@bp.route('/api/dbinfo', methods=['GET'])
def db_info():
    
    load_dotenv() 

    dbname = os.getenv('POSTGRES_DB')
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    host = os.getenv('POSTGRES_HOST')
    port_from_env = os.environ.get('POSTGRES_PORT', '5432')
    # Extract the port number if the format is tcp://host:port
    port = port_from_env.split(':')[-1]  # Get the last part after splitting by ':'

    db_uri = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'

    return jsonify({
        "db_uri": db_uri,
        "dbname": dbname,
        "user": user,
        "password": password,
        "host": host,
        "port": port
    }), 200

@bp.route('/api/data', methods=['GET'])
def get_chart_data():
    try:
        df = fetch_chart_data()

        # Ensure 'month' column is converted to datetime if it's not already
        df['month'] = pd.to_datetime(df['month'])

        months = df['month'].dt.strftime('%B %Y').unique().tolist()

        af_data = [0] * len(months)
        bij_data = [0] * len(months)

        for idx, month in enumerate(months):
            af_total = df[(df['month'].dt.strftime('%B %Y') == month) & (df['af_bij'] == 'Af')]['total']
            bij_total = df[(df['month'].dt.strftime('%B %Y') == month) & (df['af_bij'] == 'Bij')]['total']

            if not af_total.empty:
                af_data[idx] = af_total.values[0]
            if not bij_total.empty:
                bij_data[idx] = bij_total.values[0]

        return jsonify({
            'labels': months,
            'af_data': af_data,
            'bij_data': bij_data
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/load-data', methods=['GET'])
def load_data():

    try:
        result = load_csv_data()
        return jsonify({
            "message": "Data loaded successfully",
            "details": result
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/getlabels', methods=['GET'])
def get_labels():
    try:
        label_tree = get_ordered_labels_as_dataframe()
        return jsonify({
            "message": "Here is the list of labels",
            "details": label_tree
        }), 200
    except Exception as e:
        logging.error("An error occurred: %s", str(e))
        return jsonify({'error': str(e)}), 500


    
@bp.route('/api/getlabelmonth', methods=['GET'])
def get_label_month():
    try:
        transactions = fetch_all_transactions()  # Fetch all transactions from the database
        logging.info(f"Num of transactions: {len(transactions)}")

        # Extract years and months from the transaction data
        years_set = set()
        months_set = set()
        for transaction in transactions:
            date = transaction.datum
            years_set.add(date.year)
            months_set.add(date.month)

        logging.info(f"Years: {years_set}, Months: {months_set}")

        return jsonify({
            'years': list(years_set),
            'months': list(months_set)
        })
    except Exception as e:
        logging.error(f"Error in /api/getlabelmonth: {e}")
        return jsonify({'error': str(e)}), 500
    
@bp.route('/api/updateLabel', methods=['POST'])
def update_label():
    data = request.get_json()
    transaction_id = data.get('transactionId')
    label_name = data.get('labelName')
    try:
        update_transaction_label(transaction_id, label_name)
        return jsonify({'message': 'Label updated successfully'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    
@bp.route('/api/transactions/summary', methods=['GET'])
def get_transaction_summary():
    try:
        logging.info("Received request to /api/transactions/summary")
        summary = fetch_transactions_by_label_and_month()
        logging.info("Returning transaction summary")
        return jsonify(summary)
    except Exception as e:
        logging.error(f"Error in /api/transactions/summary: {e}")
        return jsonify({'error': str(e)}), 500

@bp.route('/api/update_label_order', methods=['POST'])
def update_label_order_route():
    try:
        # Directly get the list from the request
        data = request.get_json()  # No need to use .get('treeData') since the list is at the root
        
        # Check if 'data' exists and is a list
        if not isinstance(data, list):
            return jsonify({"error": "Invalid data format. Expected a list of label categories."}), 400

        def validate_node(node):
            if 'title' not in node or 'type' not in node or 'children' not in node:
                return False

            if node['type'] == 'label' and len(node['children']) > 0:
                return False

            return True

        def validate_tree(nodes):
            for node in nodes:
                if not validate_node(node):
                    return False
                if len(node['children']) > 0 and not validate_tree(node['children']):
                    return False
            return True

        if not validate_tree(data):
            return jsonify({"error": "Invalid data format. Tree structure validation failed."}), 400

        # Update label order in the database
        update_label_order(data)

        return jsonify({"message": "Label order updated successfully."}), 200

    except Exception as e:
        logging.error(f"Error in /api/update_label_order: {e}")
        return jsonify({'error': str(e)}), 500



@bp.route('/api/add-label', methods=['POST'])
def add_label():
    data = request.json
    name = data.get('name')

    if not name:
        return jsonify({'error': 'Label name is required'}), 400

    try:
        label_id = add_label_to_db(name)
        return jsonify({'id': label_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/add-category', methods=['POST'])
def add_category():
    data = request.json
    name = data.get('name')

    if not name:
        return jsonify({'error': 'Category name is required'}), 400

    try:
        category_id = add_category_to_db(name)
        return jsonify({'id': category_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


""" @bp.route('/api/train-model', methods=['POST'])
def train_model():
    session = get_session()

    try:
        # Fetch all transactions that have labels
        labeled_transactions = session.query(TransactionLabel).all()

        if not labeled_transactions:
            return jsonify({'message': 'No labeled transactions found for training'}), 400

        # Fetch the transaction text and labels
        data = [(trans.transaction_id, trans.label.name) for trans in labeled_transactions]


        # Assuming you have a function that trains the model
        model = train_model_on_data(data)

        # Save the trained model
        joblib.dump(model, 'trained_model.pkl')
        
        logging.info(f"Model trained on {len(data)} labeled transactions.")

        return jsonify({'message': 'Model trained successfully', 'transactions': len(data)}), 200

    except Exception as e:
        logging.error(f"Error training the model: {e}")
        return jsonify({'message': f"Error training the model: {e}"}), 500
    finally:
        session.close() """