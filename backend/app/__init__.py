import os
from flask import Flask, send_from_directory
from .config import Config

def create_app():
    app = Flask(__name__, static_folder='../frontend/build', static_url_path='/')

    app.config.from_object(Config)

    with app.app_context():
        from . import routes
        app.register_blueprint(routes.main_bp)

        @app.route('/', defaults={'path': ''})
        @app.route('/<path:path>')
        def serve_react_app(path):
            if path and os.path.exists(app.static_folder + '/' + path):
                return send_from_directory(app.static_folder, path)
            else:
                return send_from_directory(app.static_folder, 'index.html')

    return app