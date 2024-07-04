from flask import Flask
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, scoped_session
from .config import Config
from .models import Base
from .routes import bp

def create_app():
    app = Flask(__name__)
    app.config.from_object(Config)
    app.config['DEBUG'] = True  # Enable debug mode

    engine = create_engine(app.config['SQLALCHEMY_DATABASE_URI'])
    Session = scoped_session(sessionmaker(bind=engine))

    with app.app_context():
        # Register the blueprint
        app.register_blueprint(bp)

        # Create database tables if they do not exist
        Base.metadata.create_all(engine)

    # Store the session factory on the app
    app.session_factory = Session

    return app
