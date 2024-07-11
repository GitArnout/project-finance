import pandas as pd
import csv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from .models import Transaction, Label, TransactionLabel, LabelCategory
from flask import current_app
from sqlalchemy.dialects.postgresql import insert
import logging
from datetime import date

def get_session():
    try:
        engine = create_engine(current_app.config['SQLALCHEMY_DATABASE_URI'])
        Session = sessionmaker(bind=engine)
        logging.info("Database session created successfully.")
        return Session()
    except Exception as e:
        logging.error(f"Error creating database session: {e}")
        raise e

def fetch_all_transactions():
    session = get_session()
    try:
        transactions = session.query(Transaction).all()
        logging.info(f"Number of transactions fetched: {len(transactions)}")
        return transactions
    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching transactions: {e}")
        raise e
    finally:
        session.close()

def fetch_labels():
    session = get_session()
    try:
        labels = session.query(Label).all()
        return labels
    except Exception as e:
        session.rollback()
        raise e
    finally:
        session.close()

def update_transaction_label(transaction_id, label_name):
    session = get_session()
    try:
        label = session.query(Label).filter_by(name=label_name).first()
        if not label:
            raise ValueError(f'Label "{label_name}" not found')

        transaction_label = session.query(TransactionLabel).filter_by(transaction_id=transaction_id).first()
        if transaction_label:
            transaction_label.label_id = label.id
        else:
            new_transaction_label = TransactionLabel(transaction_id=transaction_id, label_id=label.id)
            session.add(new_transaction_label)

        session.commit()
        logging.info(f'Label "{label_name}" linked to transaction {transaction_id}')
    except Exception as e:
        session.rollback()
        logging.error(f'Error updating transaction label: {e}')
        raise e
    finally:
        session.close()

def fetch_transactions(month_start=None):
    session = get_session()
    try:
        query = session.query(
            Transaction.id,
            Transaction.datum,
            Transaction.company,
            Transaction.bedrag_eur,
            Label.name.label('label')
        ).outerjoin(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
         .outerjoin(Label, TransactionLabel.label_id == Label.id)

        if month_start:
            month_start_date = pd.to_datetime(month_start).date()
            query = query.filter(func.date_trunc('month', Transaction.datum) == month_start_date)

        transactions = query.all()

        transaction_data = []
        for transaction in transactions:
            transaction_data.append({
                'id': transaction.id,
                'datum': transaction.datum,
                'company': transaction.company,
                'bedrag_eur': transaction.bedrag_eur,
                'label': transaction.label
            })

        return transaction_data
    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching transactions: {e}")
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
            # Define the categories to be inserted
            categories_data = [
                {'name': 'INKOMSTEN', 'parent_id': None},
                {'name': 'UITGAVEN', 'parent_id': None},
                {'name': 'VASTE LASTEN', 'parent_id': 'UITGAVEN'},
                {'name': 'Huis', 'parent_id': 'VASTE LASTEN'},
                {'name': 'Lokale lasten', 'parent_id': 'VASTE LASTEN'},
                {'name': 'Verzekeringen', 'parent_id': 'VASTE LASTEN'},
                {'name': 'HUISHOUDELIJKE UITGAVEN', 'parent_id': 'UITGAVEN'},
                {'name': 'RESERVERINGSUITGAVEN', 'parent_id': 'UITGAVEN'}
            ]

            # Create a dictionary to map category names to their IDs
            category_id_map = {}

            # Insert categories into the database
            for cat_data in categories_data:
                name = cat_data['name']
                parent_name = cat_data['parent_id']

                # Resolve parent_id from name if it exists
                parent_id = category_id_map.get(parent_name)

                insert_stmt = insert(LabelCategory).values(name=name, parent_id=parent_id).on_conflict_do_nothing(index_elements=['name'])
                session.execute(insert_stmt)
                session.flush()

                # Update the category_id_map with the newly inserted category
                category = session.query(LabelCategory).filter_by(name=name).one()
                category_id_map[name] = category.id

            # Define the labels to be inserted
            labels_data = [
                {'name': 'Salaris', 'category_id': 'INKOMSTEN'},
                {'name': 'Huur', 'category_id': 'Huis'},
                {'name': 'Gas + Stroom', 'category_id': 'Huis'},
                {'name': 'Hoogheemraadschap', 'category_id': 'Lokale lasten'},
                {'name': 'Zorgverzekering', 'category_id': 'Verzekeringen'},
                {'name': 'Inboedel', 'category_id': 'Verzekeringen'},
                {'name': 'Zakgeld', 'category_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Boodschappen', 'category_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Kinderen', 'category_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Auto', 'category_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Overige', 'category_id': 'HUISHOUDELIJKE UITGAVEN'},
                {'name': 'Bruiloft', 'category_id': 'RESERVERINGSUITGAVEN'},
                {'name': 'Auto', 'category_id': 'RESERVERINGSUITGAVEN'}
            ]

            # Create a dictionary to map label names to their IDs
            label_id_map = {}

            # Insert labels into the database
            for label_data in labels_data:
                name = label_data['name']
                category_name = label_data['category_id']

                # Resolve category_id from name
                category_id = category_id_map.get(category_name)

                insert_stmt = insert(Label).values(name=name, category_id=category_id).on_conflict_do_nothing(index_elements=['name'])
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

def get_ordered_labels_as_dataframe():
    session = get_session()
    try:
        labels = session.query(Label).all()
        categories = session.query(LabelCategory).all()

        label_data = [{'id': label.id, 'name': label.name, 'category_id': label.category_id} for label in labels]
        category_data = [{'id': category.id, 'name': category.name, 'parent_id': category.parent_id} for category in categories]

        category_dict = {cat['id']: cat for cat in category_data}

        def build_tree(category_id):
            category = category_dict.get(category_id)
            if not category:
                return None
            children = [build_tree(cat['id']) for cat in category_data if cat['parent_id'] == category_id]
            return {'id': category['id'], 'name': category['name'], 'children': [child for child in children if child]}

        roots = [build_tree(cat['id']) for cat in category_data if cat['parent_id'] is None]

        def append_labels(node):
            if 'id' in node:
                node['labels'] = [label for label in label_data if label['category_id'] == node['id']]
            for child in node.get('children', []):
                append_labels(child)

        for root in roots:
            append_labels(root)

        return roots

    finally:
        session.close()

def fetch_transactions_by_label_and_month():
    session = get_session()
    try:
        # Query to fetch transactions with their labels
        logging.info("Fetching transactions from the database")
        query = session.query(
            Transaction.datum,
            Transaction.bedrag_eur,
            Label.name.label('label')
        ).outerjoin(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
         .outerjoin(Label, TransactionLabel.label_id == Label.id)

        transactions = query.all()
        logging.info(f"Fetched {len(transactions)} transactions")

        # Create a DataFrame from the transactions
        data = {
            'datum': [transaction.datum for transaction in transactions],
            'bedrag_eur': [transaction.bedrag_eur for transaction in transactions],
            'label': [transaction.label for transaction in transactions]
        }
        df = pd.DataFrame(data)
        logging.info("Created DataFrame from transactions")

        # Ensure 'datum' is parsed correctly
        def parse_date(date_val):
            try:
                if isinstance(date_val, date):  # If date_val is already a datetime.date object
                    return pd.to_datetime(date_val)
                elif isinstance(date_val, str):
                    if len(date_val) == 8:  # Format YYYYMMDD
                        return pd.to_datetime(date_val, format='%Y%m%d')
                    else:
                        return pd.to_datetime(date_val)  # Default parser
                else:
                    return pd.NaT  # Return NaT (Not a Time) for invalid cases
            except Exception as e:
                logging.error(f"Error parsing date: {date_val} - {e}")
                return pd.NaT

        df['datum'] = df['datum'].apply(parse_date)
        logging.info("Parsed 'datum' column to datetime")

        # Drop rows with invalid dates
        df = df.dropna(subset=['datum'])
        logging.info(f"Filtered DataFrame to remove rows with invalid dates, resulting in {len(df)} records")

        # Add 'month' and 'year' columns
        df['month'] = df['datum'].dt.month_name()
        df['year'] = df['datum'].dt.year
        logging.info("Added 'month' and 'year' columns")

        # Filter the DataFrame for the specific year (if required)
        df = df[df['year'] == 2024]  # Assuming we are interested in the year 2024
        logging.info(f"Filtered DataFrame for the year 2024, resulting in {len(df)} records")

        # Group by 'label' and 'month', then sum 'bedrag_eur'
        summary = df.groupby(['label', 'month'])['bedrag_eur'].sum().unstack(fill_value=0)
        logging.info("Grouped and summed DataFrame by 'label' and 'month'")

        # Ensure all months are present
        all_months = ['January', 'February', 'March', 'April', 'May', 'June', 
                      'July', 'August', 'September', 'October', 'November', 'December']
        summary = summary.reindex(columns=all_months, fill_value=0)
        logging.info("Reindexed summary to ensure all months are present")

        # Reset index to make 'label' a column again
        summary = summary.reset_index()
        logging.info("Reset index to make 'label' a column")

        result = summary.to_dict(orient='records')
        logging.info(f"Final summary: {result}")

        return result

    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching transactions by label and month: {e}")
        raise e
    finally:
        session.close()
        logging.info("Database session closed")
