from sqlalchemy import Column, Integer, String, Date, DECIMAL, ForeignKey, Text, create_engine
from sqlalchemy.orm import relationship, declarative_base

Base = declarative_base()

class Transaction(Base):
    __tablename__ = 'transactions'
    id = Column(Integer, primary_key=True)
    datum = Column(Date)
    company = Column(String(255))
    rekening = Column(String(255))
    tegenrekening = Column(String(255))
    code = Column(String(50))
    af_bij = Column(String(50))
    bedrag_eur = Column(DECIMAL)
    mutatiesoort = Column(String(255))
    mededelingen = Column(Text)

class TransactionLabel(Base):
    __tablename__ = 'transaction_labels'
    transaction_id = Column(Integer, ForeignKey('transactions.id'), primary_key=True)
    label_id = Column(Integer, ForeignKey('labels.id'), primary_key=True)

class Label(Base):
    __tablename__ = 'labels'
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    category_id = Column(Integer, ForeignKey('categories.id'))

class Category(Base):
    __tablename__ = 'categories'
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    parent_id = Column(Integer, ForeignKey('categories.id'))
    parent = relationship("Category", remote_side=[id], backref='children')
