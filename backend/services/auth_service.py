"""
auth_service.py — Register, login, cookie-based authentication.

- Passwords are hashed with bcrypt (industry-standard, never stored plain-text).
- user_id is stored directly in an HTTP-only cookie — no JWT, no session table.
- On login/register the cookie is set by the route handler using the returned user dict.
"""

import uuid
import bcrypt
from datetime import datetime
from fastapi import Cookie, HTTPException
from database import get_connection


# ── Password Helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── Register ──────────────────────────────────────────────────────────────────

def register_user(name: str, email: str, password: str) -> dict:
    """
    Create a new user account.
    - Checks for duplicate email.
    - Generates an SVG avatar from the user's initial letter.
    - Returns a user dict ready for the cookie response.
    Raises ValueError if the email is already registered.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id FROM users WHERE email=%s", (email,))
        if cur.fetchone():
            raise ValueError("Email already registered.")

        user_id  = str(uuid.uuid4())
        joined_at = int(datetime.now().timestamp() * 1000)
        pw_hash  = hash_password(password)

        # SVG avatar — shows first letter of name on an emerald background
        initial = name.strip()[0].upper()
        avatar = (
            f"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' "
            f"viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/>"
            f"<text x='50' y='50' dy='.35em' text-anchor='middle' font-size='40' "
            f"fill='white' font-family='sans-serif'>{initial}</text></svg>"
        )

        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, avatar_url, joined_at) "
            "VALUES (%s,%s,%s,%s,%s,%s)",
            (user_id, name, email, pw_hash, avatar, joined_at),
        )
        conn.commit()
        return {
            "id": user_id,
            "name": name,
            "email": email,
            "avatar": avatar,
            "joinedAt": joined_at,
        }
    finally:
        cur.close()
        conn.close()


# ── Login ──────────────────────────────────────────────────────────────────────

def login_user(email: str, password: str) -> dict:
    """
    Validate credentials and return the user dict.
    Raises ValueError on wrong email or password.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, email, password_hash, avatar_url, joined_at "
            "FROM users WHERE email=%s",
            (email,),
        )
        user = cur.fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            raise ValueError("Invalid email or password.")
        return {
            "id":       user["id"],
            "name":     user["name"],
            "email":    user["email"],
            "avatar":   user["avatar_url"],
            "joinedAt": user["joined_at"],
        }
    finally:
        cur.close()
        conn.close()


# ── Current User (FastAPI Dependency) ─────────────────────────────────────────

def get_current_user(user_id: str = Cookie(None)) -> dict:
    """
    FastAPI dependency — reads user_id from the HTTP-only cookie.
    Used on every protected route with `Depends(get_current_user)`.
    Returns the full user row or raises 401 if not logged in.
    Raises 403 if the user has been disabled by an admin.
    """
    if not user_id:
        raise HTTPException(status_code=401, detail="Not logged in")
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, email, avatar_url, joined_at FROM users WHERE id=%s",
            (user_id,),
        )
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        # Check if admin has disabled this user
        cur.execute("SELECT reason FROM disabled_users WHERE user_id=%s", (user_id,))
        disabled = cur.fetchone()
        if disabled:
            raise HTTPException(status_code=403, detail=f"Account disabled: {disabled['reason']}")
        return user
    finally:
        cur.close()
        conn.close()
