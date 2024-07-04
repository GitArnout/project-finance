import os
from sqlalchemy import create_engine, Column, Integer, String, Date, DECIMAL, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from time import sleep
from dotenv import load_dotenv

Base = declarative_base()

def connect_to_db():
    load_dotenv()
    while True:
        try:
            dbname = os.getenv('POSTGRES_DB')
            user = os.getenv('POSTGRES_USER')
            password = os.getenv('POSTGRES_PASSWORD')
            host = os.getenv('POSTGRES_HOST')
            port_from_env = os.environ.get('POSTGRES_PORT', '5432')
            port = port_from_env.split(':')[-1]
            db_uri = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'
            engine = create_engine(db_uri)
            return engine
        except Exception as e:
            print(f"Error connecting to database: {e}")
            sleep(2)

def create_tables(engine):
    Base.metadata.create_all(engine)
    print("Database initialization completed.")

if __name__ == '__main__':
    engine = connect_to_db()
    create_tables(engine)