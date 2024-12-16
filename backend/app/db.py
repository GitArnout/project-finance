import pandas as pd
import csv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from .models import Transaction, Label, TransactionLabel, LabelCategory
from flask import current_app, jsonify
from sqlalchemy.dialects.postgresql import insert
import logging
from datetime import date
from datetime import datetime
import re
import joblib  # Import joblib to load the model
import sys


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
    # Load your custom model (ensure the path is correct)
    MODEL_PATH = 'label_predictor.joblib'
    custom_model = joblib.load(MODEL_PATH)


    session = get_session()
    try:
        query = session.query(
            Transaction.id,
            Transaction.datum,
            Transaction.company,
            Transaction.rekening,
            Transaction.tegenrekening,
            Transaction.code,
            Transaction.af_bij,
            Transaction.bedrag_eur,
            Transaction.mededelingen,
            Transaction.mutatiesoort,
            Label.name.label('label')
        ).outerjoin(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
         .outerjoin(Label, TransactionLabel.label_id == Label.id)

        if month_start:
            month_start_date = pd.to_datetime(month_start).date()
            query = query.filter(func.date_trunc('month', Transaction.datum) == month_start_date)

        transactions = query.all()

        transaction_data = []
        for transaction in transactions:
            # Only check for time if mutatiesoort is 'Betaalautomaat' or 'iDEAL'
            if transaction.mutatiesoort in ['Betaalautomaat', 'iDEAL']:
                # Search for time pattern (HH:MM) in 'mededelingen'
                time_match = re.search(r'\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b', transaction.mededelingen)
                if time_match:
                    time_str = time_match.group(0)
                    # Combine date and time
                    datetime_obj = datetime.combine(transaction.datum, datetime.strptime(time_str, '%H:%M').time())
                    datum_with_time = datetime_obj.strftime('%d-%m-%Y %H:%M')
                else:
                    datum_with_time = transaction.datum.strftime('%d-%m-%Y')
            else:
                datum_with_time = transaction.datum.strftime('%d-%m-%Y')
            
            # Get the suggested label from the model
            # Prepare input for the model (you might need to adjust the input format based on your model)
            model_input = [transaction.company]  # Assuming company is used for prediction
            suggested_label = custom_model.predict(model_input)[0]  # Predict label
            label_probabilities = custom_model.predict_proba(model_input)[0]  # Get probabilities for all labels

            # Find the index of the suggested label
            label_classes = custom_model.classes_  # Get the list of all labels
            suggested_label_index = list(label_classes).index(suggested_label)
            suggested_label_probability = label_probabilities[suggested_label_index]  # Get probability for the suggested label

            logging.info(f"Model input: {model_input}")
            logging.info(f"Predicted probabilities: {label_probabilities}")

            transaction_data.append({
                'id': transaction.id,
                'datum': datum_with_time,
                'company': transaction.company,
                'rekening': transaction.rekening,
                'tegenrekening': transaction.tegenrekening,
                'code': transaction.code,
                'af_bij': transaction.af_bij,
                'bedrag_eur': transaction.bedrag_eur,
                'mededelingen': transaction.mededelingen,
                'mutatiesoort': transaction.mutatiesoort,
                'label': transaction.label,
                'suggested_label': suggested_label,
                'label_probability': suggested_label_probability  # Store only the probability for the suggested label
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
            with open('data.csv', 'r', encoding='utf-8') as file:  # Added encoding
                reader = csv.DictReader(file)

                # Strip whitespace from fieldnames just in case
                reader.fieldnames = [field.strip() for field in reader.fieldnames]

                # Ensure 'Bedrag (EUR)' is in the headers
                if 'Bedrag (EUR)' not in reader.fieldnames:
                    raise ValueError("Column 'Bedrag (EUR)' not found in CSV file.")

                for row in reader:
                    total_lines += 1

                    bedrag_eur = row['Bedrag (EUR)'].replace(',', '.')  # Replace comma with period

                    # Convert date string to a datetime object
                    datum = datetime.strptime(row['Datum'], '%Y%m%d').date()

                    # Check if the record already exists
                    exists = session.query(Transaction.id).filter_by(
                        datum=datum,
                        company=row['Naam / Omschrijving'],
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
                            datum=datum,
                            company=row['Naam / Omschrijving'],
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
        logging.info(f"CSV data loaded successfully: {new_lines} new lines, {existing_lines} existing lines out of {total_lines} total lines.")
    except Exception as e:
        session.rollback()  # Rollback the transaction if an exception occurs
        logging.error(f"Error loading CSV data: {e}")
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

            # Insert labels into the database
            for label_data in labels_data:
                name = label_data['name']
                category_name = label_data['category_id']

                # Resolve category_id from name
                category_id = category_id_map.get(category_name)

                insert_stmt = insert(Label).values(name=name, category_id=category_id).on_conflict_do_nothing(index_elements=['name'])
                session.execute(insert_stmt)
                session.flush()

            session.commit()
            logging.info("Tables and initial data created successfully.")
        else:
            logging.info("Labels already exist.")
    except Exception as e:
        session.rollback()
        logging.error(f"An error occurred: {e}")
    finally:
        session.close()

def get_ordered_labels_as_dataframe():
    session = get_session()
    try:
        # Fetch all labels and categories from the database
        labels = session.query(Label).all()
        categories = session.query(LabelCategory).all()

        # Prepare the label and category data with their respective fields
        label_data = [{'id': label.id, 'name': label.name, 'category_id': label.category_id, 'type': 'label'} for label in labels]
        category_data = [{'id': category.id, 'name': category.name, 'parent_id': category.parent_id, 'type': 'category'} for category in categories]

        # Create a dictionary of categories for easy lookup
        category_dict = {cat['id']: cat for cat in category_data}

        # Recursive function to build the tree structure
        def build_tree(category_id):
            category = category_dict.get(category_id)
            if not category:
                return None
            # Recursively build the tree for child categories
            children = [build_tree(cat['id']) for cat in category_data if cat['parent_id'] == category_id]
            return {
                'id': category['id'],
                'name': category['name'],
                'type': 'category',  # Explicitly mark this as a category
                'children': [child for child in children if child]  # Filter out None values
            }

        # Find the root categories (those without a parent)
        roots = [build_tree(cat['id']) for cat in category_data if cat['parent_id'] is None]

        # Function to append labels to each category node
        def append_labels(node):
            if 'id' in node:
                node['labels'] = [label for label in label_data if label['category_id'] == node['id']]
            # Recursively append labels to child nodes
            for child in node.get('children', []):
                append_labels(child)

        # Attach labels to each root category
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

def update_label_order(label_order_data):
    session = get_session()
    try:
        def process_node(node, parent_category_id=None):
            if node['type'] == 'label':
                # This is a label, update its category_id to the parent's id
                label = session.query(Label).filter_by(name=node['title']).first()
                if not label:
                    raise ValueError(f"Label with title '{node['title']}' not found")
                
                label.category_id = parent_category_id
            elif node['type'] == 'category':
                # This is a category, update its parent_id
                category = session.query(LabelCategory).filter_by(name=node['title']).first()
                if not category:
                    raise ValueError(f"Category with title '{node['title']}' not found")
                
                category.parent_id = parent_category_id
                
                # Process the children of this category
                for child in node['children']:
                    process_node(child, parent_category_id=category.id)

        # Iterate over each top-level category in the label_order_data
        for category in label_order_data:
            process_node(category, parent_category_id=None)

        session.commit()
        logging.info("Label order and categories updated successfully in the database.")
    except Exception as e:
        session.rollback()
        logging.error(f"Error updating label order and categories: {e}")
        raise e
    finally:
        session.close()

def add_label_to_db(name, category_id=None):
    session = get_session()
    try:
        # Insert the new label
        new_label = Label(name=name, category_id=category_id)
        session.add(new_label)
        session.flush()  # Flush to get the new ID without committing

        label_id = new_label.id  # Retrieve the ID of the newly inserted label

        session.commit()  # Commit the transaction
        logging.info(f"Label '{name}' inserted successfully with ID {label_id}.")
    except Exception as e:
        session.rollback()  # Rollback if there is an error
        logging.error(f"Error inserting label '{name}' into the database: {e}")
        raise e
    finally:
        session.close()
        
    return label_id

def add_category_to_db(name):
    session = get_session()
    try:
        # Insert the new category
        new_category = LabelCategory(name=name)
        session.add(new_category)
        session.flush()  # Flush to get the new ID without committing

        category_id = new_category.id  # Retrieve the ID of the newly inserted category

        session.commit()  # Commit the transaction
        logging.info(f"Category '{name}' inserted successfully with ID {category_id}.")
    except Exception as e:
        session.rollback()  # Rollback if there is an error
        logging.error(f"Error inserting category '{name}' into the database: {e}")
        raise e
    finally:
        session.close()
    
    return category_id
def fetch_transaction_sums_per_label_per_month():

    session = get_session()
    try:
        query = session.query(
            Transaction.id,
            Transaction.datum,
            Transaction.company,
            Transaction.rekening,
            Transaction.tegenrekening,
            Transaction.code,
            Transaction.af_bij,
            Transaction.bedrag_eur,
            Transaction.mededelingen,
            Transaction.mutatiesoort,
            Label.name.label('label')
        ).outerjoin(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
         .outerjoin(Label, TransactionLabel.label_id == Label.id)

        transactions = query.all()

        # Prepare data for aggregation
        transaction_data = []
        for transaction in transactions:
            # Only check for time if mutatiesoort is 'Betaalautomaat' or 'iDEAL'
            if transaction.mutatiesoort in ['Betaalautomaat', 'iDEAL']:
                # Search for time pattern (HH:MM) in 'mededelingen'
                time_match = re.search(r'\b([01]?[0-9]|2[0-3]):[0-5][0-9]\b', transaction.mededelingen)
                if time_match:
                    time_str = time_match.group(0)
                    # Combine date and time
                    datetime_obj = datetime.combine(transaction.datum, datetime.strptime(time_str, '%H:%M').time())
                    datum_with_time = datetime_obj.strftime('%d-%m-%Y %H:%M')
                else:
                    datum_with_time = transaction.datum.strftime('%d-%m-%Y')
            else:
                datum_with_time = transaction.datum.strftime('%d-%m-%Y')
            

            transaction_data.append({
                'datum': transaction.datum,
                'label': transaction.label,
                'bedrag_eur': transaction.bedrag_eur
            })

        # Convert to DataFrame for easy aggregation
        df = pd.DataFrame(transaction_data)

        # Ensure 'datum' is a datetime object
        df['datum'] = pd.to_datetime(df['datum'])

        # Extract year and month for grouping
        df['year_month'] = df['datum'].dt.to_period('M')

        # Group by label and year_month, then sum the amounts
        aggregated = df.groupby(['label', 'year_month'])['bedrag_eur'].sum().reset_index()

        # Convert year_month back to string for JSON serialization
        aggregated['year_month'] = aggregated['year_month'].astype(str)

        # Convert to list of dictionaries
        result = aggregated.to_dict(orient='records')

        return jsonify(result)
    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching transaction sums: {e}")
        raise e
    finally:
        session.close()

def get_reserveringsuitgaven_sum_per_month():
    session = get_session()
    try:
        # Get the LabelCategory object for 'RESERVERINGSUITGAVEN'
        reserveringsuitgaven_category = session.query(LabelCategory).filter(LabelCategory.name == 'RESERVERINGSUITGAVEN').first()
        if not reserveringsuitgaven_category:
            raise ValueError("Category 'RESERVERINGSUITGAVEN' not found")

        # Get the labels linked to this category
        labels = reserveringsuitgaven_category.labels

        # Get the names of the labels
        label_names = [label.name for label in labels]

        # Fetch transactions for these labels
        query = session.query(
            Transaction.datum,
            Transaction.bedrag_eur,
            Label.name.label('label')
        ).join(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
         .join(Label, TransactionLabel.label_id == Label.id) \
         .filter(Label.name.in_(label_names))

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

        # Extract year and month for grouping
        df['year_month'] = df['datum'].dt.to_period('M')

        # Group by year_month and sum the amounts
        aggregated = df.groupby(['year_month'])['bedrag_eur'].sum().reset_index()

        # Convert year_month back to string for JSON serialization
        aggregated['year_month'] = aggregated['year_month'].astype(str)

        # Convert to list of dictionaries
        result = aggregated.to_dict(orient='records')

        return jsonify(result)
    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching RESERVERINGSUITGAVEN transaction sums: {e}")
        raise e
    finally:
        session.close()


def get_expenses_per_main_category():
    session = get_session()
    sys.setrecursionlimit(1500)
    try:
        logging.info("Fetching UITGAVEN category")

        # Get the LabelCategory object for 'UITGAVEN'
        uitgaven_category = session.query(LabelCategory).filter(LabelCategory.name == 'UITGAVEN').first()
        if not uitgaven_category:
            raise ValueError("Category 'UITGAVEN' not found")

        logging.info(f"Fetched UITGAVEN category with ID: {uitgaven_category.id}")

        # Get the first-level children of the 'UITGAVEN' category
        first_level_children = session.query(LabelCategory).filter(LabelCategory.parent_id == uitgaven_category.id).all()

        logging.info(f"Fetched {len(first_level_children)} first-level children of UITGAVEN category")

        results = []

        for child in first_level_children:
            logging.info(f"Processing child category: {child.name}")

            # Get the labels linked to this child category
            labels = child.labels

            # Get the names of the labels
            label_names = [label.name for label in labels]

            logging.info(f"Fetched {len(label_names)} labels for child category: {child.name}")

            # Fetch transactions for these labels
            query = session.query(
                func.date_trunc('month', Transaction.datum).label('month'),
                func.sum(Transaction.bedrag_eur).label('total_amount')
            ).join(TransactionLabel, Transaction.id == TransactionLabel.transaction_id) \
             .join(Label, TransactionLabel.label_id == Label.id) \
             .filter(Label.name.in_(label_names)) \
             .group_by(func.date_trunc('month', Transaction.datum))

            transactions = query.all()

            logging.info(f"Fetched {len(transactions)} transactions for child category: {child.name}")

            # Convert results to list of dictionaries
            monthly_sums = [{'month': transaction.month.strftime('%Y-%m'), 'total_amount': transaction.total_amount} for transaction in transactions]

            results.append({
                'category': child.name,
                'monthly_sums': monthly_sums
            })

        return jsonify(results)
    except Exception as e:
        session.rollback()
        logging.error(f"Error fetching UITGAVEN transaction sums: {e}")
        raise e
    finally:
        session.close()

def fetch_transactions_overview():
    session = get_session()

    try:
        # Fetch all categories
        categories = session.query(LabelCategory).all()

        # Fetch all labels
        labels = session.query(Label).all()

        # Fetch all transactions and sum the total values per month per label
        transactions = session.query(
            TransactionLabel.label_id,
            func.date_trunc('month', Transaction.datum).label('month'),
            func.sum(Transaction.bedrag_eur).label('total_amount')
        ).join(Transaction, Transaction.id == TransactionLabel.transaction_id) \
         .group_by(TransactionLabel.label_id, func.date_trunc('month', Transaction.datum)).all()

        # Create a dictionary to hold the categories
        category_dict = {category.id: category for category in categories}

        # Create a nested dictionary to represent the hierarchical structure
        overview = []

        def add_category_to_overview(category):
            if category.parent_id is None:
                if not any(cat['name'] == category.name for cat in overview):
                    overview.append({
                        'name': category.name,
                        'id': category.id,
                        'parent_id': category.parent_id,
                        'labels': [],
                        'subcategories': [],
                        'transactions_total': 0,
                        'monthly_total': {}
                    })
            else:
                parent_category = category_dict.get(category.parent_id)
                if parent_category:
                    parent_name = parent_category.name
                    parent_overview = find_category_in_overview(overview, parent_name)
                    if parent_overview:
                        parent_overview['subcategories'].append({
                            'name': category.name,
                            'id': category.id,
                            'parent_id': category.parent_id,
                            'labels': [],
                            'subcategories': [],
                            'transactions_total': 0,
                            'monthly_total': {}
                        })

        def find_category_in_overview(overview, category_name):
            for category in overview:
                if category['name'] == category_name:
                    return category
                result = find_category_in_overview(category['subcategories'], category_name)
                if result:
                    return result
            return None

        def add_label_to_category(label, transactions_dict):
            category = category_dict.get(label.category_id)
            if category:
                category_overview = find_category_in_overview(overview, category.name)
                if category_overview:
                    transactions_total = sum(transactions_dict.get(label.id, {}).values())
                    category_overview['labels'].append({
                        'name': label.name,
                        'id': label.id,
                        'transactions_monthly': transactions_dict.get(label.id, {}),
                        'transactions_total': transactions_total
                    })
                    category_overview['transactions_total'] += transactions_total
                    for month, amount in transactions_dict.get(label.id, {}).items():
                        if month not in category_overview['monthly_total']:
                            category_overview['monthly_total'][month] = 0
                        category_overview['monthly_total'][month] += amount

        def update_category_totals(category):
            for subcategory in category['subcategories']:
                update_category_totals(subcategory)
                category['transactions_total'] += subcategory['transactions_total']
                for month, amount in subcategory['monthly_total'].items():
                    if month not in category['monthly_total']:
                        category['monthly_total'][month] = 0
                    category['monthly_total'][month] += amount

        # Sum transactions per label
        transactions_dict = {}
        for transaction in transactions:
            label_id = transaction.label_id
            month = transaction.month.strftime('%Y-%m')
            if label_id not in transactions_dict:
                transactions_dict[label_id] = {}
            if month not in transactions_dict[label_id]:
                transactions_dict[label_id][month] = 0
            transactions_dict[label_id][month] += transaction.total_amount

        # Add all categories to the overview
        for category in categories:
            add_category_to_overview(category)

        # Add all labels to the appropriate categories
        for label in labels:
            add_label_to_category(label, transactions_dict)

        # Update transactions_total and monthly_total for each category
        for category in overview:
            update_category_totals(category)

        return jsonify(overview)
    except Exception as e:
        session.rollback()
        logging.error(f"Error in fetch_transactions_overview: {e}", exc_info=True)
        raise e
    finally:
        session.close()