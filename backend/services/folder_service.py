"""
folder_service.py — Create, list, and delete scan folders in MySQL.

Deleting a folder does NOT delete the scans inside it —
it just sets their folder_id to NULL so they stay in history ungrouped.
"""

import uuid
from datetime import datetime
from database import get_connection


def get_folders(user_id: str) -> list:
    """Return all folders for a user, newest first."""
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, created_at FROM folders "
            "WHERE user_id=%s ORDER BY created_at DESC",
            (user_id,),
        )
        rows = cur.fetchall()
        return [
            {
                "id":        r["id"],
                "name":      r["name"],
                "createdAt": r["created_at"],  # already BIGINT in ms
            }
            for r in rows
        ]
    finally:
        cur.close()
        conn.close()


def create_folder(user_id: str, name: str) -> dict:
    """Create a new folder and return it."""
    fid = str(uuid.uuid4())
    ts  = int(datetime.now().timestamp() * 1000)
    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO folders (id, user_id, name, created_at) VALUES (%s,%s,%s,%s)",
            (fid, user_id, name, ts),
        )
        conn.commit()
        return {"id": fid, "name": name, "createdAt": ts}
    finally:
        cur.close()
        conn.close()


def delete_folder(folder_id: str, user_id: str) -> None:
    """
    Delete a folder.
    Scans inside are unlinked (folder_id → NULL) but NOT deleted.
    """
    conn = get_connection()
    cur  = conn.cursor()
    try:
        # Unassign scans from this folder first to avoid FK issues
        cur.execute(
            "UPDATE scan_history SET folder_id=NULL "
            "WHERE folder_id=%s AND user_id=%s",
            (folder_id, user_id),
        )
        cur.execute(
            "DELETE FROM folders WHERE id=%s AND user_id=%s",
            (folder_id, user_id),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
