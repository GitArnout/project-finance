import os
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

class Config:

    port_from_env = os.getenv('POSTGRES_PORT', '5432')
    port = port_from_env.split(':')[-1]
    
    SQLALCHEMY_DATABASE_URI = (
        f'postgresql://{os.getenv("POSTGRES_USER")}:{os.getenv("POSTGRES_PASSWORD")}'
        f'@{os.getenv("POSTGRES_HOST")}:{port}/{os.getenv("POSTGRES_DB")}'
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
