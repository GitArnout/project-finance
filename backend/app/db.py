import os
import csv
import logging
from sqlalchemy import create_engine, text
from sqlalchemy.orm import scoped_session, sessionmaker
from dotenv import load_dotenv

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Database connection function using SQLAlchemy
def get_db_connection():
    load_dotenv()
    # Retrieve connection parameters from environment variables or configuration
    dbname = os.getenv('POSTGRES_DB')
    user = os.getenv('POSTGRES_USER')
    password = os.getenv('POSTGRES_PASSWORD')
    host = os.getenv('POSTGRES_HOST')
    port_from_env = os.environ.get('POSTGRES_PORT', '5432')
    # Extract the port number if the format is tcp://host:port
    port = port_from_env.split(':')[-1]  # Get the last part after splitting by ':'

    db_uri = f'postgresql://{user}:{password}@{host}:{port}/{dbname}'
    engine = create_engine(db_uri)
    db_session = scoped_session(sessionmaker(autocommit=False, autoflush=False, bind=engine))

    return engine, db_session

def create_table_if_not_exists():
    engine, db_session = get_db_connection()

    with engine.connect() as conn:
        check_table_query = """
        SELECT EXISTS (
           SELECT FROM 
               information_schema.tables 
           WHERE 
               table_schema = 'public' AND 
               table_name = 'transactions'
           );
        """
        result = conn.execute(text(check_table_query))
        table_exists = result.scalar()

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
            conn.execute(text(create_table_query))
            conn.commit()
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
        result = conn.execute(text(check_labels_table_query))
        labels_table_exists = result.scalar()

        if not labels_table_exists:
            create_labels_table_query = """
            CREATE TABLE labels (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) UNIQUE NOT NULL
            );
            """
            conn.execute(text(create_labels_table_query))
            conn.commit()
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
        result = conn.execute(text(check_transaction_labels_table_query))
        transaction_labels_table_exists = result.scalar()

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
            conn.execute(text(create_transaction_labels_table_query))
            conn.commit()
            print("Table 'transaction_labels' created successfully.")
        else:
            print("Table 'transaction_labels' already exists.")

    db_session.remove()

def load_csv_data():
    engine, db_session = get_db_connection()

    try:
        with engine.connect() as conn:
            conn.begin()  # Begin a transaction

            with open('data.csv', 'r') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    bedrag_eur = row['Bedrag (EUR)'].replace(',', '.')  # Replace comma with period
                    query = """
                        INSERT INTO transactions (datum, company, rekening, tegenrekening, code, af_bij, bedrag_eur, mutatiesoort, mededelingen)
                        VALUES (:datum, :company, :rekening, :tegenrekening, :code, :af_bij, :bedrag_eur, :mutatiesoort, :mededelingen)
                    """
                    logger.info("row")
                    logger.info(row)

                    conn.execute(text(query), {
                        'datum': row['Datum'],
                        'company': row['Company'],
                        'rekening': row['Rekening'],
                        'tegenrekening': row['Tegenrekening'],
                        'code': row['Code'],
                        'af_bij': row['Af Bij'],
                        'bedrag_eur': bedrag_eur,
                        'mutatiesoort': row['Mutatiesoort'],
                        'mededelingen': row['Mededelingen']
                    })

            conn.commit()  # Commit the transaction
            logger.info("Data loaded successfully.")

    except Exception as e:
        conn.rollback()  # Rollback the transaction if an exception occurs
        logger.error(f"Error loading data: {e}")

    finally:
        db_session.close()  # Close the session