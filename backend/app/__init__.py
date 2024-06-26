from flask import Flask
from app.routes import main
from dotenv import load_dotenv
from .db import create_table_if_not_exists

load_dotenv()

def create_app():
    app = Flask(__name__)
    
    # Load configurations
    app.config.from_object('config.Config')
    
    # Register blueprints
    app.register_blueprint(main)
    
    # Initialize database tables
    #create_table_if_not_exists()

    return app
