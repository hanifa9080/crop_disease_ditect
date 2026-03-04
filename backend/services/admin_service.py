"""admin_service.py — Admin auth and dashboard data."""
import uuid
import bcrypt
from datetime import datetime
from database import get_connection


def login_admin(username: str, password: str) -> dict:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, username, password_hash FROM admins WHERE username=%s", (username,))
        admin = cur.fetchone()
        if not admin or not bcrypt.checkpw(password.encode(), admin['password_hash'].encode()):
            raise ValueError("Invalid admin credentials")
        return {"id": admin['id'], "username": admin['username'], "role": "admin"}
    finally:
        cur.close(); conn.close()


def get_current_admin(admin_id: str):
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, username FROM admins WHERE id=%s", (admin_id,))
        admin = cur.fetchone()
        if not admin:
            return None
        return {"id": admin['id'], "username": admin['username'], "role": "admin"}
    finally:
        cur.close(); conn.close()


def get_user_stats() -> dict:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT COUNT(*) as total FROM users")
        total = cur.fetchone()['total']
        cur.execute("SELECT COUNT(*) as failed FROM login_attempts WHERE success=0 AND attempted_at > NOW() - INTERVAL 24 HOUR")
        failed = cur.fetchone()['failed']
        cur.execute("""
            SELECT u.id, u.name, u.email, u.created_at,
                   COUNT(s.id) as scan_count,
                   CASE WHEN d.user_id IS NOT NULL THEN 1 ELSE 0 END as is_disabled
            FROM users u
            LEFT JOIN scan_history s ON u.id = s.user_id
            LEFT JOIN disabled_users d ON u.id = d.user_id
            GROUP BY u.id ORDER BY u.created_at DESC LIMIT 50
        """)
        users = cur.fetchall()
        for u in users:
            if isinstance(u.get('created_at'), datetime):
                u['created_at'] = u['created_at'].isoformat()
        return {"total_users": total, "failed_logins_24h": failed, "users": users}
    finally:
        cur.close(); conn.close()


def get_scan_stats() -> dict:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT COUNT(*) as total_today FROM scan_history WHERE created_at > CURDATE()")
        today = cur.fetchone()['total_today']
        cur.execute("SELECT COUNT(*) as total_week FROM scan_history WHERE created_at > NOW() - INTERVAL 7 DAY")
        week = cur.fetchone()['total_week']
        cur.execute("""
            SELECT r.plant_name, COUNT(*) as count, AVG(r.confidence) as avg_confidence
            FROM scan_results r
            WHERE r.created_at > NOW() - INTERVAL 7 DAY AND r.plant_name NOT LIKE '%healthy%'
            GROUP BY r.plant_name ORDER BY count DESC LIMIT 10
        """)
        top_diseases = cur.fetchall()
        cur.execute("""
            SELECT DATE(created_at) as date, COUNT(*) as scans
            FROM scan_history WHERE created_at > NOW() - INTERVAL 7 DAY
            GROUP BY DATE(created_at) ORDER BY date
        """)
        daily = cur.fetchall()
        for d in daily:
            if hasattr(d.get('date'), 'isoformat'):
                d['date'] = d['date'].isoformat()
        return {"scans_today": today, "scans_this_week": week, "top_diseases": top_diseases, "daily_scans": daily}
    finally:
        cur.close(); conn.close()


def get_performance_metrics() -> dict:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT AVG(response_time_ms) as avg_ms, MAX(response_time_ms) as max_ms,
                   COUNT(*) as total_requests,
                   SUM(CASE WHEN status_code >= 400 THEN 1 ELSE 0 END) as errors
            FROM request_metrics WHERE created_at > NOW() - INTERVAL 1 HOUR
        """)
        m = cur.fetchone()
        cur.execute("SELECT COUNT(*) as rpm FROM request_metrics WHERE created_at > NOW() - INTERVAL 1 MINUTE")
        rpm = cur.fetchone()['rpm']
        return {
            "avg_response_ms": round(m['avg_ms'] or 0, 2),
            "max_response_ms": round(m['max_ms'] or 0, 2),
            "requests_per_minute": rpm,
            "total_requests_1h": m['total_requests'],
            "error_count_1h": m['errors']
        }
    finally:
        cur.close(); conn.close()


def get_chat_logs(limit: int = 50) -> list:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT c.id, u.name as user_name, c.user_message, c.ai_response, c.created_at
            FROM chat_logs c LEFT JOIN users u ON c.user_id = u.id
            ORDER BY c.created_at DESC LIMIT %s
        """, (limit,))
        logs = cur.fetchall()
        for log in logs:
            if isinstance(log.get('created_at'), datetime):
                log['created_at'] = log['created_at'].isoformat()
        return logs
    finally:
        cur.close(); conn.close()


def get_error_logs(limit: int = 100) -> list:
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("""
            SELECT * FROM system_logs WHERE log_type IN ('error','warning')
            ORDER BY created_at DESC LIMIT %s
        """, (limit,))
        logs = cur.fetchall()
        for log in logs:
            if isinstance(log.get('created_at'), datetime):
                log['created_at'] = log['created_at'].isoformat()
        return logs
    finally:
        cur.close(); conn.close()


def disable_user(user_id: str, reason: str, admin_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO disabled_users (user_id, reason, disabled_by) VALUES (%s,%s,%s) "
            "ON DUPLICATE KEY UPDATE reason=%s, disabled_by=%s",
            (user_id, reason, admin_id, reason, admin_id)
        )
        conn.commit()
    finally:
        cur.close(); conn.close()


def enable_user(user_id: str):
    conn = get_connection()
    cur = conn.cursor()
    try:
        cur.execute("DELETE FROM disabled_users WHERE user_id=%s", (user_id,))
        conn.commit()
    finally:
        cur.close(); conn.close()


def log_system_event(log_type: str, source: str, message: str):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO system_logs (log_type, source, message) VALUES (%s,%s,%s)",
            (log_type, source, message[:2000])
        )
        conn.commit()
        cur.close(); conn.close()
    except Exception:
        pass
