import os
from pathlib import Path
import re
import getpass
import csv
import mysql.connector
#Author: Vivek

"""
Shipmates DB builder
"""


def _prompt(value: str, env_var: str, secret: bool = False) -> str:
    """
    Ask the user for a value, showing the current env-var/default.
    Returns the provided value or the fallback if left blank.
    """
    if os.getenv(env_var) is not None:
        return os.getenv(env_var)
    current = os.getenv(env_var, value)
    prompt_text = f"{env_var} [{current}]: "
    reader = input if secret else input
    entered = reader(prompt_text)
    return entered.strip() or current

# --- CONFIGURATION ---
DB_NAME = "Shipmates"
DB_CONFIG = {
    "host": _prompt("localhost", "MYSQL_HOST"),
    "port": int(_prompt("3306", "MYSQL_PORT")),
    "user": _prompt("root", "MYSQL_USER"),
    "password": _prompt("", "MYSQL_PASSWORD", secret=True),
    "allow_local_infile": os.getenv("MYSQL_LOCAL_INFILE", "1") in {"1", "true", "TRUE", "yes", "YES"},
}
# ---------------------


def _iter_mysql_statements(filepath: Path):
    """
    A parser that correctly handles:
    - DELIMITER commands
    - Comments (--, #, and /*...*/)
    - Multi-line statements
    - String literals (to avoid false-positive delimiter splits)
    """
    with open(filepath, 'r', encoding='utf-8') as f:
        full_sql = f.read()

    # Regex to strip comments. This is more robust.
    # Strip block comments /* ... */
    full_sql = re.sub(r'/\*.*?\*/', '', full_sql, flags=re.DOTALL)
    # Strip line comments -- ... and # ...
    full_sql = re.sub(r'(--|#).*?$', '', full_sql, flags=re.MULTILINE)

    delimiter = ";"
    statement = ""

    for line in full_sql.splitlines():
        line = line.strip()
        if not line:
            continue

        # Check for delimiter change
        if line.upper().startswith("DELIMITER"):
            try:
                delimiter = line.split()[1]
                # This line is a command, not part of a statement
                continue
            except IndexError:
                # Malformed delimiter, but we skip it
                continue
        
        # Add the line to the current statement
        if statement:
            statement += "\n" + line
        else:
            statement = line

        # If the statement ends with the delimiter
        if statement.endswith(delimiter):
            # Clean statement: remove delimiter and leading/trailing whitespace
            cleaned_stmt = statement[:-len(delimiter)].strip()
            if cleaned_stmt:
                yield cleaned_stmt
            # Reset for next statement
            statement = ""

    # Yield any remaining statement (in case file doesn't end with delimiter)
    if statement.strip():
        # This case might happen if the last statement is missing its delimiter
        # We clean it as best we can
        if statement.endswith(delimiter):
             cleaned_stmt = statement[:-len(delimiter)].strip()
             if cleaned_stmt:
                yield cleaned_stmt
        else:
             # It's a partial statement, but we yield it
             yield statement.strip()


def execute_sql_file(cursor, filepath_str: str) -> bool:
    """
    Executes all statements from a .sql file using the custom parser.
    Returns True on success, False on failure.
    """
    filepath = Path(filepath_str)
    if not filepath.exists():
        print(f"  [WARN] File not found: {filepath_str}")
        return True  # Don't fail the build, just skip it

    print(f"Executing SQL file: {filepath_str}...")
    try:
        statements = list(_iter_mysql_statements(filepath))
        if not statements:
            print("  (File is empty or only contains comments)")
            return True

        for stmt in statements:
            try:
                # The _iter_mysql_statements parser already gives us
                # one statement at a time. We don't need 'multi=True'.
                cursor.execute(stmt)

            except mysql.connector.Error as err:
                print(f"  [ERROR] Failed executing statement from {filepath.name}: {err}")
                
                # Truncate statement for printing
                stmt_preview = stmt[:100].replace('\n', ' ') + "..." if len(stmt) > 100 else stmt.replace('\n', ' ')
                print(f"    Statement: {stmt_preview}")
                return False
        
        return True

    except Exception as e:
        print(f"  [ERROR] Failed parsing file {filepath.name}: {e}")
        return False


def seed_data_from_csv(cursor, base_dir: Path):
    """
    Seed database tables using standard SQL insert statements,
    avoiding the use of LOAD DATA LOCAL INFILE.
    """
    from datetime import date

    # 1. Colleges
    colleges_path = base_dir / "data" / "Clean_data" / "colleges_clean.csv"
    if colleges_path.exists():
        print("Seeding Colleges...")
        with open(colleges_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader) # skip header
            except StopIteration:
                header = []
            colleges = [row[0].strip() for row in reader if row]
        
        # We assign sequential college_id values explicitly to ensure they match
        # the hardcoded college_id references in usm_courses_clean.csv.
        colleges_with_ids = [(i + 1, name) for i, name in enumerate(colleges)]
        insert_query = "INSERT INTO Colleges (college_id, college_name) VALUES (%s, %s)"
        cursor.executemany(insert_query, colleges_with_ids)
        print(f"  Inserted {len(colleges_with_ids)} colleges.")
    else:
        print(f"  [WARN] Colleges CSV not found at: {colleges_path}")

    # 2. Courses
    courses_path = base_dir / "data" / "Clean_data" / "usm_courses_clean.csv"
    if courses_path.exists():
        print("Seeding Courses...")
        with open(courses_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader) # skip header
            except StopIteration:
                header = []
            courses = []
            for row in reader:
                if not row:
                    continue
                code = row[0].strip()
                name = row[1].strip()
                college_id = int(row[2].strip())
                courses.append((code, name, college_id))
        
        insert_query = "INSERT INTO Courses (course_code, course_name, college_id) VALUES (%s, %s, %s)"
        cursor.executemany(insert_query, courses)
        print(f"  Inserted {len(courses)} courses.")
    else:
        print(f"  [WARN] Courses CSV not found at: {courses_path}")

    # 3. Test Users
    print("Seeding test users...")
    users_to_insert = [
        (1001, 'sg_owner@example.com', 'x', 'Study', 'Owner'),
        (1002, 'sg_member@example.com', 'x', 'Study', 'Member'),
        (1003, 'sg_requester@example.com', 'x', 'Study', 'Requester'),
        (1004, 'sg_morning@example.com', 'x', 'Study', 'Morning'),
        (1005, 'sg_pair@example.com', 'x', 'Study', 'Pair'),
        (1006, 'sg_solo@example.com', 'x', 'Study', 'Solo')
    ]
    insert_users_query = "INSERT INTO Users (user_id, email, password_hash, first_name, last_name) VALUES (%s, %s, %s, %s, %s)"
    cursor.executemany(insert_users_query, users_to_insert)
    print(f"  Inserted {len(users_to_insert)} test users.")

    # 4. Resources
    resources_path = base_dir / "data" / "Clean_data" / "course_resources_cleaned.csv"
    if resources_path.exists():
        print("Seeding Resources...")
        today = date.today().isoformat()
        resources = []
        with open(resources_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader) # skip header
            except StopIteration:
                header = []
            for row in reader:
                if not row:
                    continue
                course_name = row[0].strip()
                topic_name = row[1].strip()
                content_snippet = row[2].strip()
                resource_url = row[3].strip()
                resource_type = row[4].strip()
                
                title = f"{course_name} — {topic_name}"
                if len(title) > 100:
                    title = title[:97] + "..."
                
                resources.append((1001, title, content_snippet, resource_type, resource_url, today))
                
        insert_query = """
            INSERT INTO Resource (uploader_id, title, description, filetype, source, upload_date)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.executemany(insert_query, resources)
        print(f"  Inserted {len(resources)} resources.")
    else:
        print(f"  [WARN] Resources CSV not found at: {resources_path}")

    # 5. Quiz, Questions, Answers
    questions_path = base_dir / "data" / "Clean_data" / "quiz_questions_clean.csv"
    answers_path = base_dir / "data" / "Clean_data" / "quiz_answers_clean.csv"
    
    if questions_path.exists() and answers_path.exists():
        print("Seeding Quiz, Questions, and Answers...")
        cursor.execute(
            "INSERT INTO Quiz (title, description, course_id, creator_id) VALUES (%s, %s, %s, %s)",
            ('SQL Basics (Imported)', 'Imported from Clean_data', None, 1001)
        )
        quiz_id = cursor.lastrowid
        
        old_to_new_qid = {}
        with open(questions_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                header = []
            for row in reader:
                if not row:
                    continue
                old_qid = int(row[0].strip())
                q_text = row[2].strip()
                q_type = row[3].strip()
                pts = int(row[4].strip())
                
                cursor.execute(
                    "INSERT INTO Question (quiz_id, question_text, question_type, points) VALUES (%s, %s, %s, %s)",
                    (quiz_id, q_text, q_type, pts)
                )
                new_qid = cursor.lastrowid
                old_to_new_qid[old_qid] = new_qid
        
        answers_to_insert = []
        with open(answers_path, mode='r', encoding='utf-8') as f:
            reader = csv.reader(f)
            try:
                header = next(reader)
            except StopIteration:
                header = []
            for row in reader:
                if not row:
                    continue
                old_qid = int(row[1].strip())
                ans_text = row[2].strip()
                is_corr_str = row[3].strip().lower()
                
                is_correct = 1 if is_corr_str in ('1', 'true', 't', 'yes', 'y') else 0
                new_qid = old_to_new_qid.get(old_qid)
                if new_qid is not None:
                    answers_to_insert.append((new_qid, ans_text, is_correct))
        
        if answers_to_insert:
            insert_query = "INSERT INTO Answer (question_id, answer_text, is_correct) VALUES (%s, %s, %s)"
            cursor.executemany(insert_query, answers_to_insert)
            print(f"  Inserted {len(answers_to_insert)} answers.")
        print("Quiz seeding completed.")
    else:
        print(f"  [WARN] Quiz CSV files not found. Questions: {questions_path.exists()}, Answers: {answers_path.exists()}")


def main():
    """
    - Connects to MySQL (no DB specified)
    - Drops/Creates the DB_NAME
    - Connects to the new DB
    - Runs schema and procedure SQL files
    - Seeds data from CSV files using Python
    - Runs remaining SQL files
    """
    
    # List of SQL files to run, IN ORDER of dependency
    sql_files_in_order = [
        # --- schemas ---
        "sql/schema/User_Management.sql",
        "sql/schema/study_Management_script.sql",
        "sql/schema/StudyGroupsAndCollaboration.sql",
        "sql/schema/Quizzes&Flashcards.sql",
        "sql/schema/AI_Drafts.sql",
        # --- procedures ---
        "sql/procedures/Study_Management_procedures.sql",
        "sql/procedures/StudyGroupAndCollaborationProcedures.sql",
        "sql/procedures/GroupInviteAndMatching.sql",
    ]

    try:
        # 1. Connect to MySQL server (no database)
        print(f"Connecting to MySQL at {DB_CONFIG['host']}:{DB_CONFIG['port']} as {DB_CONFIG['user']}...")
        conn = mysql.connector.connect(**DB_CONFIG)
        cursor = conn.cursor(buffered=True)
        print("Connection successful.")

        # 2. Drop and recreate the database
        print(f"Resetting database '{DB_NAME}'...")
        cursor.execute(f"DROP DATABASE IF EXISTS `{DB_NAME}`")
        cursor.execute(f"CREATE DATABASE `{DB_NAME}` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
        cursor.execute(f"USE `{DB_NAME}`")
        print(f"Database '{DB_NAME}' created and selected.")

        # 3. Enable LOCAL INFILE if not enabled
        cursor.execute("SHOW GLOBAL VARIABLES LIKE 'local_infile'")
        infile_status = cursor.fetchone()
        if not infile_status or infile_status[1] != 'ON':
            print("  [WARN] 'local_infile' is OFF on the server. Attempting to set.")
            try:
                cursor.execute("SET GLOBAL local_infile = 1")
            except mysql.connector.Error as err:
                print(f"  [ERROR] Could not set GLOBAL local_infile: {err}")
                print("  [HINT] Managed database services (like Aiven) require you to enable 'local_infile' in the dashboard advanced settings.")
        
        # 4. Execute all SQL files in order
        print("\nStarting database build...")
        base_dir = Path(__file__).resolve().parent
        for idx, rel_path in enumerate(sql_files_in_order):
            filepath = base_dir / rel_path
            if not execute_sql_file(cursor, str(filepath)):
                # If any file fails, stop the build
                print(f"\n[FATAL] Build failed at: {filepath}")
                conn.rollback()
                return
            
            # This commit is necessary to make changes from one
            # file visible to the NEXT file.
            conn.commit()

            # Reset cursor between files to avoid sync issues
            if idx < len(sql_files_in_order) - 1:
                try:
                    cursor.close()
                except Exception:
                    pass
                cursor = conn.cursor(buffered=True)

        # 5. Seed data using Python (avoids LOAD DATA LOCAL INFILE)
        try:
            print("\nSeeding data from CSV files...")
            try:
                cursor.close()
            except Exception:
                pass
            cursor = conn.cursor(buffered=True)
            seed_data_from_csv(cursor, base_dir)
            conn.commit()
            print("[SUCCESS] Seeding from CSV files completed.")
        except Exception as e:
            print(f"\n[FATAL] Seeding failed: {e}")
            conn.rollback()
            return

        # 6. Run any post-seeding SQL scripts (like fake_data_Script.sql)
        post_sql_files = [
            "sql/load/fake_data_Script.sql"
        ]
        for rel_path in post_sql_files:
            filepath = base_dir / rel_path
            try:
                cursor.close()
            except Exception:
                pass
            cursor = conn.cursor(buffered=True)
            if not execute_sql_file(cursor, str(filepath)):
                print(f"\n[FATAL] Post-seeding script failed: {filepath}")
                conn.rollback()
                return
            conn.commit()

        print("\n[SUCCESS] Database build and seeding completed successfully!")

    except mysql.connector.Error as err:
        print(f"\n[FATAL] A MySQL error occurred: {err}")
        if getattr(err, "errno", None) == 2003:  # Can't connect
            print("  [HINT] Is your MySQL server (like XAMPP or MySQL Workbench) running?")
        elif getattr(err, "errno", None) == 1045:  # Access denied
            print("  [HINT] Check MYSQL_USER / MYSQL_PASSWORD environment variables.")

    finally:
        # 7. Clean up
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()
            print("MySQL connection closed.")

if __name__ == "__main__":
    main()

