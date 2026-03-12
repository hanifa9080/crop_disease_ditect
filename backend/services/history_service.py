"""
history_service.py — Save, load, and delete plant scan history.

- Images are stored on disk at backend/uploads/{user_id}/{scan_id}.jpg
- Scan metadata and AI results are persisted in MySQL (scan_history + scan_results).
- The AI model is NOT called here — analysis already happened before save_scan() is called.
"""

import uuid
import json
import os
import base64
from datetime import datetime
from pathlib import Path
from database import get_connection

# Absolute path — works regardless of where uvicorn is launched from
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)


# ── Save Scan ─────────────────────────────────────────────────────────────────

def save_scan(user_id: str, image_base64: str | None, results: list) -> dict:
    """
    Persist a completed plant scan:
      1. Decode and write the image to disk (if provided).
      2. Insert a row into scan_history.
      3. Insert one row per result into scan_results.
    Returns the full scan record (same shape as get_history items).
    """
    scan_id   = str(uuid.uuid4())
    timestamp = int(datetime.now().timestamp() * 1000)
    image_path, image_url = None, None

    # Save image file if a base64 payload was sent
    if image_base64:
        user_dir = UPLOAD_DIR / user_id
        user_dir.mkdir(exist_ok=True)
        # Strip data-URL prefix if present (e.g. "data:image/jpeg;base64,...")
        b64 = image_base64.split(",", 1)[1] if "," in image_base64 else image_base64
        file_path = user_dir / f"{scan_id}.jpg"
        with open(file_path, "wb") as f:
            f.write(base64.b64decode(b64))
        image_path = str(file_path)
        image_url  = f"/uploads/{user_id}/{scan_id}.jpg"

    conn = get_connection()
    cur  = conn.cursor()
    try:
        # Insert the scan row
        cur.execute(
            "INSERT INTO scan_history (id, user_id, image_path, image_url, timestamp) "
            "VALUES (%s,%s,%s,%s,%s)",
            (scan_id, user_id, image_path, image_url, timestamp),
        )

        # Insert one result row per detected plant
        for r in results:
            cur.execute(
                """
                INSERT INTO scan_results
                    (id, scan_id, plant_name, disease_name, confidence, is_plant, diagnosis,
                     alternatives, issues, treatment_plan, prevention_tips, expert_resources)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    str(uuid.uuid4()),
                    scan_id,
                    r.get("plantName", "Unknown"),
                    r.get("diseaseName", ""),
                    r.get("confidence", 0),
                    r.get("isPlant", True),
                    r.get("diagnosis", ""),
                    json.dumps(r.get("alternatives", [])),
                    json.dumps(r.get("issues", {})),
                    json.dumps(r.get("treatmentPlan", [])),
                    json.dumps(r.get("preventionTips", [])),
                    json.dumps(r.get("expertResources", [])),
                ),
            )
    finally:
        conn.commit()
        cur.close()
        conn.close()

    return {
        "id":        scan_id,
        "timestamp": timestamp,
        "imageUrl":  image_url,
        "folderId":  None,
        "results":   results,
    }


# ── Get History ───────────────────────────────────────────────────────────────

def get_history(user_id: str) -> list:
    """
    Return all scan history for a user, newest first.
    Each item contains the full list of scan_results for that scan.
    """
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, timestamp, image_url, folder_id "
            "FROM scan_history WHERE user_id=%s ORDER BY timestamp DESC",
            (user_id,),
        )
        scans   = cur.fetchall()
        history = []

        for scan in scans:
            cur.execute(
                "SELECT * FROM scan_results WHERE scan_id=%s",
                (scan["id"],),
            )
            results = []
            for r in cur.fetchall():
                results.append({
                    "plantName":       r["plant_name"],
                    "diseaseName":     r.get("disease_name") or "",
                    "confidence":      r["confidence"],
                    "isPlant":         bool(r["is_plant"]),
                    "diagnosis":       r["diagnosis"],
                    "alternatives":    json.loads(r["alternatives"]    or "[]"),
                    "issues":          json.loads(r["issues"]          or "{}"),
                    "treatmentPlan":   json.loads(r["treatment_plan"]  or "[]"),
                    "preventionTips":  json.loads(r["prevention_tips"] or "[]"),
                    "expertResources": json.loads(r["expert_resources"]or "[]"),
                })

            history.append({
                "id":        scan["id"],
                "timestamp": scan["timestamp"],
                "imageUrl":  scan["image_url"],
                "folderId":  scan["folder_id"],
                "results":   results,
            })

        return history
    finally:
        cur.close()
        conn.close()


# ── Delete Scan ───────────────────────────────────────────────────────────────

def delete_scan(scan_id: str, user_id: str) -> bool:
    """
    Delete a scan record (and its image file from disk).
    Returns False if the scan doesn't belong to this user.
    scan_results rows are removed automatically by ON DELETE CASCADE.
    """
    conn = get_connection()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT image_path FROM scan_history WHERE id=%s AND user_id=%s",
            (scan_id, user_id),
        )
        row = cur.fetchone()
        if not row:
            return False

        # Remove image file from disk if it exists
        if row["image_path"] and os.path.exists(row["image_path"]):
            os.remove(row["image_path"])

        cur.execute("DELETE FROM scan_history WHERE id=%s", (scan_id,))
        conn.commit()
        return True
    finally:
        cur.close()
        conn.close()
