import pandas as pd
from logging_config import logger
from sqlalchemy import text
from .db import get_db_connection


def fetch_transactions(month_start):
    engine, db_session = get_db_connection()
    with engine.connect() as conn:
        query = """
            SELECT datum, company, bedrag_eur 
            FROM transactions 
            WHERE DATE_TRUNC('month', datum) = :month_start
        """
        result = conn.execute(text(query), {'month_start': month_start})
        transactions = result.fetchall()
    db_session.remove()
    return transactions

def fetch_chart_data():
    engine, db_session = get_db_connection()
    query = """
        SELECT DATE_TRUNC('month', datum) as month, af_bij, SUM(bedrag_eur) as total
        FROM transactions
        GROUP BY month, af_bij
        ORDER BY month
    """
    
    try:
        with engine.connect() as conn:
            result = conn.execute(text(query)).mappings().all()
            data = {'month': [], 'af_bij': [], 'total': []}
            for row in result:
                data['month'].append(row['month'])
                data['af_bij'].append(row['af_bij'])
                data['total'].append(row['total'])
            df = pd.DataFrame(data)
            logger.info("Data fetched successfully.")
            return df
    except Exception as e:
        logger.error(f"Error fetching data: {e}")
        raise
    finally:
        db_session.close()