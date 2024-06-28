import os
from flask import Blueprint, jsonify, request
from dotenv import load_dotenv

main = Blueprint('main', __name__)

#Session = sessionmaker(bind=engine)

@main.route('/api/dbinfo', methods=['GET'])
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

@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@main.route('/api/hello', methods=['GET'])
def example_route():
    return jsonify({"message": "Hello, World!"}), 200