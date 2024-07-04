import pandas as pd
import csv
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
from .models import Transaction
from flask import current_app

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
