"""
database.py — MySQL connection pool + auto database + auto table creation.
Run once on startup. Creates the 'uzhavan_ai' database if it doesn't exist,
then creates all 4 tables automatically — no MySQL Workbench or manual SQL needed.
"""

import os
import mysql.connector
from mysql.connector import pooling
from dotenv import load_dotenv

load_dotenv()

_pool = None


def _ensure_database_exists():
    """
    Connect WITHOUT specifying a database and create it if missing.
    This is the only place we connect without a pool.
    """
    try:
        conn = mysql.connector.connect(
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", 3306)),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
        )
        cur = conn.cursor()
        db_name = os.getenv("MYSQL_DATABASE", "uzhavan_ai")
        cur.execute(
            f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
            f"CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
        )
        conn.commit()
        cur.close()
        conn.close()
        print(f"[DB] Database '{db_name}' ready.")
    except Exception as e:
        print(f"[DB] Could not create database: {e}")
        raise


def get_pool():
    global _pool
    if _pool is None:
        _pool = pooling.MySQLConnectionPool(
            pool_name="uzhavan_pool",
            pool_size=5,
            host=os.getenv("MYSQL_HOST", "localhost"),
            port=int(os.getenv("MYSQL_PORT", 3306)),
            user=os.getenv("MYSQL_USER", "root"),
            password=os.getenv("MYSQL_PASSWORD", ""),
            database=os.getenv("MYSQL_DATABASE", "uzhavan_ai"),
            autocommit=True,
        )
    return _pool


def get_connection():
    return get_pool().get_connection()


# ── Table Definitions ──────────────────────────────────────────────────────────

CREATE_TABLES_SQL = [
    """
    CREATE TABLE IF NOT EXISTS users (
        id            VARCHAR(36)  PRIMARY KEY,
        name          VARCHAR(100) NOT NULL,
        email         VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        avatar_url    TEXT,
        joined_at     BIGINT       NOT NULL,
        created_at    TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS scan_history (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        image_path VARCHAR(500),
        image_url  VARCHAR(500),
        timestamp  BIGINT       NOT NULL,
        folder_id  VARCHAR(36),
        created_at TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS scan_results (
        id               VARCHAR(36)  PRIMARY KEY,
        scan_id          VARCHAR(36)  NOT NULL,
        plant_name       VARCHAR(200) NOT NULL,
        confidence       FLOAT        NOT NULL,
        is_plant         BOOLEAN      DEFAULT TRUE,
        diagnosis        TEXT,
        alternatives     JSON,
        issues           JSON,
        treatment_plan   JSON,
        prevention_tips  JSON,
        expert_resources JSON,
        created_at       TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (scan_id) REFERENCES scan_history(id) ON DELETE CASCADE
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS folders (
        id         VARCHAR(36)  PRIMARY KEY,
        user_id    VARCHAR(36)  NOT NULL,
        name       VARCHAR(200) NOT NULL,
        created_at BIGINT       NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS admins (
        id VARCHAR(36) PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS login_attempts (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36),
        email VARCHAR(100),
        success BOOLEAN NOT NULL,
        ip_address VARCHAR(50),
        attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS system_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        log_type ENUM('error','info','warning') DEFAULT 'info',
        source VARCHAR(100),
        message TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS request_metrics (
        id INT AUTO_INCREMENT PRIMARY KEY,
        endpoint VARCHAR(200),
        method VARCHAR(10),
        status_code INT,
        response_time_ms FLOAT,
        user_id VARCHAR(36),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS chat_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(36),
        user_message TEXT,
        ai_response TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,

    """
    CREATE TABLE IF NOT EXISTS disabled_users (
        user_id VARCHAR(36) PRIMARY KEY,
        reason TEXT,
        disabled_by VARCHAR(36),
        disabled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    """,
]


def seed_admin():
    """Create default admin if none exists. Called once on startup."""
    try:
        import bcrypt, uuid
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id FROM admins LIMIT 1")
        if cur.fetchone():
            cur.close(); conn.close()
            return
        admin_id = str(uuid.uuid4())
        pw_hash = bcrypt.hashpw(b"uzhavan@admin2024", bcrypt.gensalt()).decode()
        cur.execute(
            "INSERT INTO admins (id, username, password_hash) VALUES (%s, %s, %s)",
            (admin_id, "admin", pw_hash)
        )
        cur.close(); conn.close()
        print("[DB] Default admin created. Username: admin | Password: uzhavan@admin2024")
    except Exception as e:
        print(f"[DB] Admin seed error: {e}")


def init_db():
    """
    Called once on FastAPI startup:
      1. Creates the 'uzhavan_ai' database if it doesn't exist.
      2. Creates all 10 tables if they don't exist.
      3. Seeds the default admin account.
    No MySQL Workbench or manual SQL needed.
    """
    _ensure_database_exists()
    conn = get_connection()
    cursor = conn.cursor()
    for sql in CREATE_TABLES_SQL:
        cursor.execute(sql)
    cursor.close()
    conn.close()
    seed_admin()
    print("[DB] All tables ready.")
