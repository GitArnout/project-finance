from flask import Flask, send_from_directory
from app.routes import main
import os

def create_app():
    app = Flask(__name__, static_folder="../frontend/build")

    # Load configurations
    app.config.from_object('config.Config')

    # Register blueprints
    app.register_blueprint(main)

    # Serve React frontend
    @app.route('/', defaults={'path': ''})
    @app.route('/<path:path>')
    def serve_react(path):
        if path != "" and os.path.exists(app.static_folder + '/' + path):
            return send_from_directory(app.static_folder, path)
        else:
            return send_from_directory(app.static_folder, 'index.html')

    return app