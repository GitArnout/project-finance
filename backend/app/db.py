import pandas as pd
import csv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from .models import Transaction, Label
from flask import current_app
from sqlalchemy.dialects.postgresql import insert

def get_session():
    engine = create_engine(current_app.config['SQLALCHEMY_DATABASE_URI'])
    Session = sessionmaker(bind=engine)
    return Session()

def fetch_transactions(month_start):
    session = get_session()
    try:
        month_start_date = pd.to_datetime(month_start).date()
        transactions = session.query(Transaction).filter(
            func.date_trunc('month', Transaction.datum) == month_start_date
        ).all()
        return transactions
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def fetch_chart_data():
    session = get_session()
    try:
        query = session.query(
            func.date_trunc('month', Transaction.datum).label('month'),
            Transaction.af_bij,
            func.sum(Transaction.bedrag_eur).label('total')
        ).group_by(
            func.date_trunc('month', Transaction.datum),
            Transaction.af_bij
        ).order_by('month')
        
        result = query.all()
        data = {'month': [], 'af_bij': [], 'total': []}
        for row in result:
            data['month'].append(row.month)
            data['af_bij'].append(row.af_bij)
            data['total'].append(row.total)
        df = pd.DataFrame(data)
        return df
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def load_csv_data():
    session = get_session()
    total_lines = 0
    new_lines = 0
    existing_lines = 0

    try:
        with session.begin():  # Begin a transaction

            with open('data.csv', 'r') as file:
                reader = csv.DictReader(file)
                for row in reader:
                    total_lines += 1

                    bedrag_eur = row['Bedrag (EUR)'].replace(',', '.')  # Replace comma with period

                    # Check if the record already exists
                    exists = session.query(Transaction.id).filter_by(
                        datum=row['Datum'],
                        company=row['Company'],
                        rekening=row['Rekening'],
                        tegenrekening=row['Tegenrekening'],
                        code=row['Code'],
                        af_bij=row['Af Bij'],
                        bedrag_eur=bedrag_eur,
                        mutatiesoort=row['Mutatiesoort'],
                        mededelingen=row['Mededelingen']
                    ).first()

                    if not exists:
                        # Insert new record
                        new_transaction = Transaction(
                            datum=row['Datum'],
                            company=row['Company'],
                            rekening=row['Rekening'],
                            tegenrekening=row['Tegenrekening'],
                            code=row['Code'],
                            af_bij=row['Af Bij'],
                            bedrag_eur=bedrag_eur,
                            mutatiesoort=row['Mutatiesoort'],
                            mededelingen=row['Mededelingen']
                        )
                        session.add(new_transaction)
                        new_lines += 1
                    else:
                        existing_lines += 1

        session.commit()  # Commit the transaction

    except Exception as e:
        session.rollback()  # Rollback the transaction if an exception occurs
        print("Error loading data:", e)
        raise e
    finally:
        session.close()

    return {
        "total_lines": total_lines,
        "new_lines": new_lines,
        "existing_lines": existing_lines
    }

def create_tables():
    session = get_session()
    try:
        # Check if categories and labels already exist
        existing_labels = session.query(Label).all()
        if not existing_labels:
            # Define the labels to be inserted
            labels_data = [
                {'name': 'INKOMSTEN', 'parent_id': None},
                {'name': 'Salaris', 'parent_id': 'INKOMSTEN'},
                {'name': 'UITGAVEN', 'parent_id': None},
                {'name': 'VASTE LASTEN', 'parent_id': 'UITGAVEN'},
                {'name': 'Huis', 'parent_id': 'VASTE LASTEN'},
                {'name': 'Huur', 'parent_id': 'Huis'},
                {'name': 'Gas + Stroom', 'parent_id': 'Huis'},
                {'name': 'Lokale lasten', 'parent_id': 'VASTE LASTEN'},
                {'name': 'Hoogheemraadschap', 'parent_id': 'Lokale lasten'},
                {'name': 'Verzekeringen', 'parent_id': 'VASTE LASTEN'},
                {'name': 'Zorgverzekering', 'parent_id': 'Verzekeringen'},
                {'name': 'Inboedel', 'parent_id': 'Verzekeringen'},
                {'name': 'HUISHOUDELIJKE UITGAVEN', 'parent_id': 'UITGAVEN'},
                {'name': 'Zakgeld', 'parent_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Boodschappen', 'parent_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Kinderen', 'parent_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Auto', 'parent_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Overige', 'parent_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'RESERVERINGSUITGAVEN', 'parent_id': 'UITGAVEN'},
                {'name': 'Bruiloft', 'parent_id': 'RESERVERINGSUITGAVEN'},
                {'name': 'Auto', 'parent_id': 'RESERVERINGSUITGAVEN'}
            ]

            # Create a dictionary to map label names to their IDs
            label_id_map = {}

            # Insert labels into the database
            for label_data in labels_data:
                name = label_data['name']
                parent_name = label_data['parent_id']

                # Resolve parent_id from name if it exists
                parent_id = label_id_map.get(parent_name)

                insert_stmt = insert(Label).values(name=name, parent_id=parent_id).on_conflict_do_nothing(index_elements=['name'])
                session.execute(insert_stmt)
                session.flush()

                # Update the label_id_map with the newly inserted label
                label = session.query(Label).filter_by(name=name).one()
                label_id_map[name] = label.id

            session.commit()
            print("Tables and initial data created successfully.")
        else:
            print("Labels already exist.")
    except Exception as e:
        session.rollback()
        print(f"An error occurred: {e}")
    finally:
        session.close()

# Function to fetch ordered data and return as DataFrame
def get_ordered_labels_as_dataframe():
    session = get_session()
    try:
        # Query labels
        labels_query = session.query(Label).all()

        # Extract data into lists
        ids = [label.id for label in labels_query]
        names = [label.name for label in labels_query]
        parent_ids = [label.parent_id for label in labels_query]

        # Create DataFrame
        labels_df = pd.DataFrame({
            'id': ids,
            'name': names,
            'parent_id': parent_ids
        })

        return labels_df
    finally:
        session.close()
