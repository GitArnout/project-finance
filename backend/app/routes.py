from flask import Blueprint, jsonify

main_bp = Blueprint('main', __name__)

@main_bp.route('/api/hello', methods=['GET'])
def hello():
    return jsonify(message="Hello from Flask!")