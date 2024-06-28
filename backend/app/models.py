import pandas as pd
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
    with engine.connect() as conn:
        query = text("""
            SELECT DATE_TRUNC('month', datum) as month, af_bij, SUM(bedrag_eur) as total
            FROM transactions
            GROUP BY month, af_bij
            ORDER BY month
        """)
        df = conn.execute(query)
    db_session.remove()
    return df