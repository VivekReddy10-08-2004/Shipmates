import mysql.connector
import os
from dotenv import load_dotenv

# Load .env if present
load_dotenv()


def get_db_connection():
    password = os.getenv("MYSQL_PASSWORD")
    if password is None:
        raise RuntimeError(
            "MYSQL_PASSWORD is not set. Copy backend/.env.example to backend/.env "
            "and fill in your local MySQL password."
        )
    return mysql.connector.connect(
        host=os.getenv("MYSQL_HOST", "127.0.0.1"),
        port=int(os.getenv("MYSQL_PORT", 3306)),
        user=os.getenv("MYSQL_USER", "root"),
        password=password,
        database=os.getenv("MYSQL_DB", "StudyBuddy"),
        autocommit=True,  # needed so profile edits don't lock
    )


#feel free to change this -- putting this here for my routes as of right now. Also feel free to delete this comment!
