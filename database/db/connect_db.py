# db/connect_db.py

import os
import mysql.connector
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

def get_connection():
    """Establish and return a MySQL connection."""
    connection = mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "LOCALHOST"), 
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=os.getenv("MYSQL_PASSWORD", ""),
        database=os.getenv("MYSQL_DB", "Shipmates")
    )
    return connection
print("MySQL connector is working!")
