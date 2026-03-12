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
        is_verified   TINYINT(1)   NOT NULL DEFAULT 0,
        otp_code      VARCHAR(6)   DEFAULT NULL,
        otp_expires   BIGINT       DEFAULT NULL,
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
    CREATE TABLE IF NOT EXISTS chat_logs (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        user_id      VARCHAR(36),
        session_id   VARCHAR(36),
        sequence_num INT DEFAULT 0,
        user_message TEXT,
        ai_response  TEXT,
        created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_session (session_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """,
]





def init_db():
    """
    Called once on FastAPI startup:
      1. Creates the 'uzhavan_ai' database if it doesn't exist.
      2. Creates all tables if they don't exist.
      3. Runs safe ALTER TABLE migrations for existing deployments.
    No MySQL Workbench or manual SQL needed.
    """
    _ensure_database_exists()
    conn = get_connection()
    cursor = conn.cursor()
    for sql in CREATE_TABLES_SQL:
        cursor.execute(sql)

    # ── Safe migrations: add new columns ─────────────────────────────────────
    # We use standard ALTER TABLE here. If the column already exists,
    # the MySQL exception is caught and ignored.
    column_migrations = [
        "ALTER TABLE chat_logs ADD COLUMN session_id   VARCHAR(36) AFTER user_id",
        "ALTER TABLE chat_logs ADD COLUMN sequence_num INT DEFAULT 0 AFTER session_id",
        # History diseaseName fix — store disease_name alongside plant_name
        "ALTER TABLE scan_results ADD COLUMN disease_name VARCHAR(200) DEFAULT '' AFTER plant_name",
        # OTP verification columns
        "ALTER TABLE users ADD COLUMN is_verified TINYINT(1) NOT NULL DEFAULT 0 AFTER password_hash",
        "ALTER TABLE users ADD COLUMN otp_code    VARCHAR(6)  DEFAULT NULL       AFTER is_verified",
        "ALTER TABLE users ADD COLUMN otp_expires BIGINT      DEFAULT NULL       AFTER otp_code",
    ]
    for migration in column_migrations:
        try:
            cursor.execute(migration)
            conn.commit()
            print(f"[DB] Migration success: {migration.split('ADD COLUMN')[1].strip().split(' ')[0]} added.")
        except Exception:
            # Catch "Duplicate column name" error and proceed
            pass

    # ── Safe migration: add idx_session index ────────────────────────────────
    try:
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_session ON chat_logs (session_id)")
        conn.commit()
    except Exception:
        pass  # Index already exists

    # ── Safe migration: add FOREIGN KEY user_id → users(id) ──────────────────
    # Delete orphaned rows first (user_id set but user no longer exists),
    # then add the FK constraint.
    try:
        cursor.execute("""
            DELETE FROM chat_logs
            WHERE user_id IS NOT NULL
              AND user_id NOT IN (SELECT id FROM users)
        """)
        conn.commit()
        deleted_orphans = cursor.rowcount
        if deleted_orphans > 0:
            print(f"[DB] Removed {deleted_orphans} orphaned chat_logs rows before adding FK.")
    except Exception as e:
        print(f"[DB] Orphan cleanup warning: {e}")

    try:
        cursor.execute("""
            ALTER TABLE chat_logs
            ADD CONSTRAINT fk_chat_logs_user
            FOREIGN KEY (user_id) REFERENCES users(id)
            ON DELETE CASCADE
        """)
        conn.commit()
        print("[DB] chat_logs FK constraint added.")
    except Exception:
        pass  # FK already exists — safe to ignore

    # ── Safe migration: activate all existing users ─────────────────────────
    # When is_verified column is first added it defaults to 0.
    # This UPDATE ensures every pre-existing account is set to verified
    # so they are NOT locked out when login starts checking the flag.
    try:
        cursor.execute("UPDATE users SET is_verified = 1 WHERE is_verified = 0 AND otp_code IS NULL")
        activated = cursor.rowcount
        conn.commit()
        if activated > 0:
            print(f"[DB] Activated {activated} existing user(s) (set is_verified=1).")
    except Exception:
        pass  # Column might not exist yet on very first run — safe to ignore

    cursor.close()
    conn.close()
    print("[DB] All tables ready.")
