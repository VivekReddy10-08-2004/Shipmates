# db/connect_db.py

import mysql.connector

def get_connection():
    """Establish and return a MySQL connection."""
    connection = mysql.connector.connect(
        host="LOCALHOST", 
        user="root",
        password="Tyvler22",
        database="Shipmates"
    )
    return connection
print("MySQL connector is working!")
