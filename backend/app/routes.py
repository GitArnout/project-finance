from flask import Blueprint, jsonify

main = Blueprint('main', __name__)

@main.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy"}), 200

@main.route('/api/hello', methods=['GET'])
def example_route():
    return jsonify({"message": "Hello, World!"}), 200