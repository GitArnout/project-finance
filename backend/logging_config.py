# logging_config.py
import logging

# Configure the logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler()
    ]
)

# Create a logger object
logger = logging.getLogger('Backend Logging started..')
