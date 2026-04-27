import os
import re
import threading
from pathlib import Path

import mysql.connector
from dotenv import load_dotenv

# Load .env if present
load_dotenv()

_BOOTSTRAP_LOCK = threading.Lock()
_BOOTSTRAP_DONE = False


def _mysql_config(include_database: bool = True) -> dict:
    password = os.getenv("MYSQL_PASSWORD")
    if password is None:
        raise RuntimeError(
            "MYSQL_PASSWORD is not set. Copy backend/.env.example to backend/.env "
            "and fill in your local MySQL password."
        )

    config = {
        "host": os.getenv("MYSQL_HOST", "127.0.0.1"),
        "port": int(os.getenv("MYSQL_PORT", 3306)),
        "user": os.getenv("MYSQL_USER", "root"),
        "password": password,
        "allow_local_infile": os.getenv("MYSQL_LOCAL_INFILE", "1").lower() in {"1", "true", "yes"},
    }
    if include_database:
        config["database"] = os.getenv("MYSQL_DB", "Shipmates")
    return config


def _iter_mysql_statements(filepath: Path):
    sql = filepath.read_text(encoding="utf-8")
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.DOTALL)
    sql = re.sub(r"(--|#).*?$", "", sql, flags=re.MULTILINE)

    delimiter = ";"
    statement = ""

    for raw_line in sql.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        if line.upper().startswith("DELIMITER"):
            parts = line.split(maxsplit=1)
            if len(parts) == 2:
                delimiter = parts[1].strip()
            continue

        statement = f"{statement}\n{line}".strip() if statement else line
        if statement.endswith(delimiter):
            cleaned = statement[: -len(delimiter)].strip()
            if cleaned:
                yield cleaned
            statement = ""

    if statement.strip():
        yield statement.strip()


def _execute_sql_file(cursor, filepath: Path, db_name: str) -> None:
    for stmt in _iter_mysql_statements(filepath):
        # Existing SQL files are hardcoded to "USE Shipmates"; rewrite at runtime
        # so the app can bootstrap whichever MYSQL_DB is configured.
        if re.match(r"^USE\s+`?Shipmates`?$", stmt, flags=re.IGNORECASE):
            stmt = f"USE `{db_name}`"
        cursor.execute(stmt)


def _phase2_sql_base_dir() -> Path:
    backend_dir = Path(__file__).resolve().parent
    project_root = backend_dir.parent.parent
    return project_root / "Project phase 2" / "sql"


def _bootstrap_database_if_missing() -> None:
    global _BOOTSTRAP_DONE

    if _BOOTSTRAP_DONE:
        return

    with _BOOTSTRAP_LOCK:
        if _BOOTSTRAP_DONE:
            return

        config_no_db = _mysql_config(include_database=False)
        db_name = os.getenv("MYSQL_DB", "Shipmates")
        sql_base = _phase2_sql_base_dir()

        sql_files = [
            sql_base / "schema" / "User_Management.sql",
            sql_base / "schema" / "study_Management_script.sql",
            sql_base / "schema" / "StudyGroupsAndCollaboration.sql",
            sql_base / "schema" / "Quizzes&Flashcards.sql",
            sql_base / "schema" / "AI_Drafts.sql",
            sql_base / "procedures" / "Study_Management_procedures.sql",
            sql_base / "procedures" / "StudyGroupAndCollaborationProcedures.sql",
            sql_base / "procedures" / "GroupInviteAndMatching.sql",
        ]

        missing_files = [str(p) for p in sql_files if not p.exists()]
        if missing_files:
            raise RuntimeError(
                "Cannot bootstrap database because required SQL files are missing:\n"
                + "\n".join(missing_files)
            )

        conn = mysql.connector.connect(**config_no_db)
        cursor = conn.cursor(buffered=True)
        try:
            cursor.execute(
                "SELECT SCHEMA_NAME FROM INFORMATION_SCHEMA.SCHEMATA WHERE SCHEMA_NAME = %s",
                (db_name,),
            )
            exists = cursor.fetchone() is not None

            if not exists:
                cursor.execute(
                    f"CREATE DATABASE `{db_name}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
                )
                cursor.execute(f"USE `{db_name}`")

                for filepath in sql_files:
                    _execute_sql_file(cursor, filepath, db_name)
                    conn.commit()

            _BOOTSTRAP_DONE = True
        finally:
            cursor.close()
            conn.close()


def get_db_connection():
    _bootstrap_database_if_missing()
    return mysql.connector.connect(
        **_mysql_config(include_database=True),
        autocommit=True,  # needed so profile edits don't lock
    )
