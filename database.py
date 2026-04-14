from sqlalchemy import create_engine, Column, Integer, String, JSON, ForeignKey, Boolean
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./backend/icu_predict.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

class Institution(Base):
    __tablename__ = "institutions"
    id = Column(String, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    name = Column(String)
    email = Column(String)
    address = Column(String)
    admin_name = Column(String)
    last_login = Column(String)
    status = Column(String, default="Active")
    permissions = Column(String, default="Level 4 (Full Access)")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    password = Column(String)
    role = Column(String)
    institution_id = Column(String, ForeignKey("institutions.id"), nullable=True)

class Subject(Base):
    __tablename__ = "subjects"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    admission_date = Column(String)
    doctor_name = Column(String)
    status = Column(String)
    institution_id = Column(String, ForeignKey("institutions.id"))
    
    # Deep Clinical Data
    vitals = Column(JSON)
    lab_reports = Column(JSON)
    medical_history = Column(JSON)
    care_team = Column(JSON)

class Staff(Base):
    __tablename__ = "staff"
    id = Column(String, primary_key=True, index=True)
    name = Column(String)
    role = Column(String)
    email = Column(String)
    status = Column(String, default="Active")
    institution_id = Column(String, ForeignKey("institutions.id"))

def init_db():
    Base.metadata.create_all(bind=engine)
