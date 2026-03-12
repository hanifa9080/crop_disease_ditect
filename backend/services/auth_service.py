"""
auth_service.py — Register (with OTP), login, cookie-based authentication.

- Passwords are hashed with bcrypt (industry-standard, never stored plain-text).
- user_id is stored directly in an HTTP-only cookie — no JWT, no session table.
- On login the cookie is set by the route handler using the returned user dict.
- On register the user receives an OTP email and must verify before they can log in.
"""

import uuid
import random
import time
import bcrypt
from datetime import datetime
from fastapi import Cookie, HTTPException
from database import get_connection
from services.email_service import send_otp_email, send_forgot_password_otp_email


# ── Password Helpers ───────────────────────────────────────────────────────────

def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())


# ── OTP Helpers ────────────────────────────────────────────────────────────────

def _generate_otp() -> str:
    """Generate a random 6-digit OTP code."""
    return str(random.randint(100000, 999999))


OTP_EXPIRY_SECONDS = 600  # 10 minutes


# ── Register ──────────────────────────────────────────────────────────────────

def register_user(name: str, email: str, password: str) -> dict:
    """
    Create a new user account with OTP verification.
    - Checks for duplicate email.
    - Generates an SVG avatar from the user's initial letter.
    - Generates a 6-digit OTP and sends it via email.
    - Returns { status: "pending", email } — user must verify OTP before login.
    Raises ValueError if the email is already registered.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute("SELECT id, is_verified FROM users WHERE email=%s", (email,))
        existing = cur.fetchone()

        if existing:
            if existing["is_verified"] == 1:
                raise ValueError("Email already registered.")
            # User exists but never verified — resend OTP
            otp = _generate_otp()
            otp_expires = int(time.time()) + OTP_EXPIRY_SECONDS
            cur.execute(
                "UPDATE users SET otp_code=%s, otp_expires=%s WHERE id=%s",
                (otp, otp_expires, existing["id"]),
            )
            conn.commit()
            send_otp_email(email, otp, name)
            return {"status": "pending", "email": email}

        user_id = str(uuid.uuid4())
        joined_at = int(datetime.now().timestamp() * 1000)
        pw_hash = hash_password(password)

        # SVG avatar — shows first letter of name on an emerald background
        initial = name.strip()[0].upper()
        avatar = (
            f"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' "
            f"viewBox='0 0 100 100'><rect width='100' height='100' fill='%2310b981'/>"
            f"<text x='50' y='50' dy='.35em' text-anchor='middle' font-size='40' "
            f"fill='white' font-family='sans-serif'>{initial}</text></svg>"
        )

        otp = _generate_otp()
        otp_expires = int(time.time()) + OTP_EXPIRY_SECONDS

        cur.execute(
            "INSERT INTO users (id, name, email, password_hash, is_verified, otp_code, otp_expires, avatar_url, joined_at) "
            "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)",
            (user_id, name, email, pw_hash, 0, otp, otp_expires, avatar, joined_at),
        )
        conn.commit()

        # Send OTP email (non-blocking — if it fails, user can resend)
        send_otp_email(email, otp, name)

        return {"status": "pending", "email": email}
    finally:
        cur.close()
        conn.close()


# ── Verify OTP ────────────────────────────────────────────────────────────────

def verify_otp(email: str, otp: str) -> dict:
    """
    Verify the OTP code for a pending user.
    - Sets is_verified=1 and clears OTP fields on success.
    - Returns the full user dict (ready for cookie response).
    Raises ValueError on invalid/expired OTP.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, email, otp_code, otp_expires, avatar_url, joined_at "
            "FROM users WHERE email=%s",
            (email,),
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("User not found.")

        # Check OTP matches
        if user["otp_code"] != otp:
            raise ValueError("Invalid verification code.")

        # Check OTP not expired
        if user["otp_expires"] and int(time.time()) > user["otp_expires"]:
            raise ValueError("Verification code expired. Please register again.")

        # Activate the user
        cur.execute(
            "UPDATE users SET is_verified=1, otp_code=NULL, otp_expires=NULL WHERE id=%s",
            (user["id"],),
        )
        conn.commit()

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


# ── Login ──────────────────────────────────────────────────────────────────────

def login_user(email: str, password: str) -> dict:
    """
    Validate credentials, generate a new OTP, and send it.
    Returns { status: "pending", email } — user must verify OTP before login.
    Raises ValueError on wrong email or wrong password.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, email, password_hash, is_verified "
            "FROM users WHERE email=%s",
            (email,),
        )
        user = cur.fetchone()
        if not user or not verify_password(password, user["password_hash"]):
            raise ValueError("Invalid email or password.")

        # Generate a new OTP for this login attempt
        otp = _generate_otp()
        otp_expires = int(time.time()) + OTP_EXPIRY_SECONDS

        cur.execute(
            "UPDATE users SET otp_code=%s, otp_expires=%s WHERE id=%s",
            (otp, otp_expires, user["id"]),
        )
        conn.commit()

        # Send OTP email
        send_otp_email(email, otp, user["name"])

        return {"status": "pending", "email": email}
    finally:
        cur.close()
        conn.close()


# ── Resend OTP ────────────────────────────────────────────────────────────────

def resend_otp(email: str) -> dict:
    """
    Resend login/signup OTP.
    - Unverified users  → resend the account-verification OTP (green email).
    - Verified users    → resend the login-step OTP (they just logged in and
                          the code expired before they could enter it).
    Raises ValueError only if the user is not found.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, is_verified FROM users WHERE email=%s",
            (email,),
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("User not found.")

        otp = _generate_otp()
        otp_expires = int(time.time()) + OTP_EXPIRY_SECONDS
        cur.execute(
            "UPDATE users SET otp_code=%s, otp_expires=%s WHERE id=%s",
            (otp, otp_expires, user["id"]),
        )
        conn.commit()
        send_otp_email(email, otp, user["name"])
        return {"status": "otp_resent", "email": email}
    finally:
        cur.close()
        conn.close()


# ── Forgot Password ────────────────────────────────────────────────────────────

def forgot_password_request(email: str) -> dict:
    """
    Initiate a password reset for an existing, verified user.
    - Checks that the email belongs to a registered, verified account.
    - Generates a fresh OTP, stores it, and sends the amber reset email.
    - Raises ValueError with a user-facing message if the email is unknown
      or belongs to an unverified account.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, name, is_verified FROM users WHERE email=%s",
            (email,),
        )
        user = cur.fetchone()

        # Email not registered at all
        if not user:
            raise ValueError("No account found with this email address.")

        # Email registered but account not verified yet
        if not user["is_verified"]:
            raise ValueError(
                "This email has not been verified yet. "
                "Please complete your account registration first."
            )

        otp = _generate_otp()
        otp_expires = int(time.time()) + OTP_EXPIRY_SECONDS
        cur.execute(
            "UPDATE users SET otp_code=%s, otp_expires=%s WHERE id=%s",
            (otp, otp_expires, user["id"]),
        )
        conn.commit()
        send_forgot_password_otp_email(email, otp, user["name"])
        return {"status": "pending", "email": email}
    finally:
        cur.close()
        conn.close()



def verify_reset_otp(email: str, otp: str) -> dict:
    """
    Step 2 of password reset: validate that the OTP is correct and not expired
    WITHOUT clearing it from the DB (the OTP is cleared later by reset_password_confirm).
    Returns { status: "valid" } on success.
    Raises ValueError on invalid/expired OTP.
    """
    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, otp_code, otp_expires FROM users WHERE email=%s AND is_verified=1",
            (email,),
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("No account found for this email.")

        if not user["otp_code"] or user["otp_code"] != otp:
            raise ValueError("Invalid reset code. Please check and try again.")

        if user["otp_expires"] and int(time.time()) > user["otp_expires"]:
            raise ValueError("Reset code has expired. Please request a new one.")

        return {"status": "valid", "email": email}
    finally:
        cur.close()
        conn.close()


def reset_password_confirm(email: str, otp: str, new_password: str) -> dict:
    """
    Verify the reset OTP and set the new hashed password.
    - Checks that the OTP matches and has not expired.
    - Hashes new_password with bcrypt and updates the DB.
    - Clears the OTP fields so the code cannot be reused.
    Returns { status: "ok" } on success.
    Raises ValueError on invalid/expired OTP or user not found.
    """
    if len(new_password) < 6:
        raise ValueError("Password must be at least 6 characters.")

    conn = get_connection()
    cur = conn.cursor(dictionary=True)
    try:
        cur.execute(
            "SELECT id, otp_code, otp_expires FROM users WHERE email=%s AND is_verified=1",
            (email,),
        )
        user = cur.fetchone()
        if not user:
            raise ValueError("User not found.")

        if user["otp_code"] != otp:
            raise ValueError("Invalid reset code.")

        if user["otp_expires"] and int(time.time()) > user["otp_expires"]:
            raise ValueError("Reset code expired. Please request a new one.")

        new_hash = hash_password(new_password)
        cur.execute(
            "UPDATE users SET password_hash=%s, otp_code=NULL, otp_expires=NULL WHERE id=%s",
            (new_hash, user["id"]),
        )
        conn.commit()
        return {"status": "ok"}
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
