from sqlalchemy import Column, Integer, String, Date, DECIMAL, ForeignKey, Text, create_engine
from sqlalchemy.orm import relationship, declarative_base, sessionmaker, backref

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

class LabelCategory(Base):
    __tablename__ = 'label_categories'
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    parent_id = Column(Integer, ForeignKey('label_categories.id'), nullable=True)
    parent = relationship('LabelCategory', remote_side=[id], backref=backref('children', cascade="all, delete-orphan"))

class Label(Base):
    __tablename__ = 'labels'
    id = Column(Integer, primary_key=True)
    name = Column(String(255), unique=True, nullable=False)
    category_id = Column(Integer, ForeignKey('label_categories.id'))
    category = relationship('LabelCategory', backref=backref('labels', cascade="all, delete-orphan"))

class TransactionLabel(Base):
    __tablename__ = 'transaction_labels'
    id = Column(Integer, primary_key=True)
    transaction_id = Column(Integer, ForeignKey('transactions.id'))
    label_id = Column(Integer, ForeignKey('labels.id'))
    transaction = relationship('Transaction', backref=backref('transaction_labels', cascade="all, delete-orphan"))
    label = relationship('Label', backref=backref('transaction_labels', cascade="all, delete-orphan")) 