import os
import pandas as pd
from flask import Blueprint, jsonify, request, current_app
from dotenv import load_dotenv
from .db import fetch_transactions, fetch_chart_data, load_csv_data

bp = Blueprint('main', __name__)

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
