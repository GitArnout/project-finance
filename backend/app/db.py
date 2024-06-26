import os
from sqlalchemy import create_engine
from sqlalchemy.orm import scoped_session, sessionmaker
from dotenv import load_dotenv


# Database connection function using SQLAlchemy
def get_db_connection():
    load_dotenv()
    # Retrieve connection parameters from environment variables or configuration
    dbname = os.getenv('POSTGRES_DB')
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    host = os.getenv('POSTGRES_HOST')
    port = os.getenv('POSTGRES_PORT', '5432')

    db_uri = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'
    engine = create_engine(db_uri, convert_unicode=True)
    db_session = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

    return engine, db_session

def create_table_if_not_exists():
    engine, db_session = get_db_connection()

    check_table_query = """
    SELECT EXISTS (
       SELECT FROM 
           information_schema.tables 
       WHERE 
           table_schema = 'public' AND 
           table_name = 'transactions'
       );
    """
    result = engine.execute(check_table_query)
    table_exists = result.fetchone()[0]

    if not table_exists:
        create_table_query = """
        CREATE TABLE transactions (
            id SERIAL PRIMARY KEY,
            datum DATE,
            company VARCHAR(255),
            rekening VARCHAR(255),
            tegenrekening VARCHAR(255),
            code VARCHAR(50),
            af_bij VARCHAR(50),
            bedrag_eur DECIMAL,
            mutatiesoort VARCHAR(255),
            mededelingen TEXT
        );
        """
        engine.execute(create_table_query)
        print("Table 'transactions' created successfully.")
    else:
        print("Table 'transactions' already exists.")

    check_labels_table_query = """
    SELECT EXISTS (
       SELECT FROM 
           information_schema.tables 
       WHERE 
           table_schema = 'public' AND 
           table_name = 'labels'
       );
    """
    result = engine.execute(check_labels_table_query)
    labels_table_exists = result.fetchone()[0]

    if not labels_table_exists:
        create_labels_table_query = """
        CREATE TABLE labels (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) UNIQUE NOT NULL
        );
        """
        engine.execute(create_labels_table_query)
        print("Table 'labels' created successfully.")
    else:
        print("Table 'labels' already exists.")

    check_transaction_labels_table_query = """
    SELECT EXISTS (
       SELECT FROM 
           information_schema.tables 
       WHERE 
           table_schema = 'public' AND 
           table_name = 'transaction_labels'
       );
    """
    result = engine.execute(check_transaction_labels_table_query)
    transaction_labels_table_exists = result.fetchone()[0]

    if not transaction_labels_table_exists:
        create_transaction_labels_table_query = """
        CREATE TABLE transaction_labels (
            transaction_id INT NOT NULL,
            label_id INT NOT NULL,
            PRIMARY KEY (transaction_id, label_id),
            FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
            FOREIGN KEY (label_id) REFERENCES labels (id) ON DELETE CASCADE
        );
        """
        engine.execute(create_transaction_labels_table_query)
        print("Table 'transaction_labels' created successfully.")
    else:
        print("Table 'transaction_labels' already exists.")

    db_session.remove()