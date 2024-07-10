import os
import pandas as pd
from flask import Blueprint, jsonify, request, current_app
from dotenv import load_dotenv
from .db import fetch_transactions, fetch_chart_data, load_csv_data, get_ordered_labels_as_dataframe, fetch_all_transactions, update_transaction_label
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