import os
import pandas as pd
from flask import Blueprint, jsonify, request, current_app
from dotenv import load_dotenv
from .db import fetch_transactions, fetch_chart_data, load_csv_data, get_ordered_labels_as_dataframe
import logging

bp = Blueprint('main', __name__)

# Configure logging
logging.basicConfig(level=logging.INFO)

@bp.route('/api/transactions', methods=['GET'])
def get_transactions():
    month = request.args.get('month')
    if not month:
        return jsonify({'error': 'Month parameter is missing'}), 400

    try:
        month_start = pd.to_datetime(month, format='%B %Y').strftime('%Y-%m-01')
        transactions = fetch_transactions(month_start)

        if not transactions:
            return jsonify([])  # Return an empty list if no transactions found

        transaction_list = [
            {
                'date': transaction.datum.strftime('%Y-%m-%d'),
                'company': transaction.company,
                'amount': float(transaction.bedrag_eur)  # Convert decimal to float
            } for transaction in transactions
        ]

        return jsonify(transaction_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@bp.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

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
        df = get_ordered_labels_as_dataframe()
        logging.info("Initial DataFrame: \n%s", df)

        # Identify rows where 'parent_id' is NULL and log them
        null_parent_ids = df[df['parent_id'].isnull()]
        logging.info("Rows where 'parent_id' is NULL: \n%s", null_parent_ids)

        # Convert NULL values in 'parent_id' to None for consistent handling
        df['parent_id'].fillna(pd.NA, inplace=True)
        logging.info("DataFrame after setting NULL values to None: \n%s", df)

        # Convert the DataFrame to a list of dictionaries for easier processing
        labels_data = df.to_dict(orient='records')
        logging.info("Labels data: %s", labels_data)

        # Create a lookup dictionary to easily find labels by id
        lookup = {label['id']: label for label in labels_data}
        logging.info("Lookup dictionary: %s", lookup)

        # Create a dictionary to hold the hierarchical structure
        tree = {}

        # Helper function to recursively build the tree
        def add_to_tree(label, tree):
            try:
                if pd.isna(label['parent_id']):  # Check for parent_id being None (or pd.NA)
                    if label['name'] not in tree:
                        tree[label['name']] = {'name': label['name'], 'children': {}}
                    return tree[label['name']]
                parent = lookup[label['parent_id']]
                parent_node = add_to_tree(parent, tree)
                if label['name'] not in parent_node['children']:
                    parent_node['children'][label['name']] = {'name': label['name'], 'children': {}}
                return parent_node['children'][label['name']]
            except Exception as e:
                logging.error("Error in add_to_tree function: %s", str(e))
                raise  # Re-raise the exception for debugging

        # Build the hierarchical tree
        for label in labels_data:
            add_to_tree(label, tree)
        
        logging.info("Tree structure: %s", tree)

        # Helper function to format the tree for output
        def format_tree(node):
            if not node['children']:
                return node['name']
            return {node['name']: [format_tree(child) for child in node['children'].values()]}

        # Format the tree for output
        output = [format_tree(root) for root in tree.values()]

        logging.info("Formatted output: %s", output)

        return jsonify({
            "message": "Here is the list of labels",
            "details": output
        }), 200
    except Exception as e:
        logging.error("An error occurred: %s", str(e))
        return jsonify({'error': str(e)}), 500