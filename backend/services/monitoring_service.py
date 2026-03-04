"""monitoring_service.py — Request metrics logging."""
from database import get_connection


def log_request(endpoint: str, method: str, status_code: int,
                response_time_ms: float, user_id: str = None):
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO request_metrics (endpoint, method, status_code, response_time_ms, user_id) VALUES (%s,%s,%s,%s,%s)",
            (endpoint[:200], method, status_code, response_time_ms, user_id)
        )
        conn.commit()
        cur.close(); conn.close()
    except Exception:
        pass
