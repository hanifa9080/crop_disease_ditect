"""
email_service.py — Send OTP verification emails via Gmail SMTP.

Uses SSL (port 465) with a Gmail App Password.
Set these in your .env file:
    SMTP_EMAIL=uzhavanai@gmail.com
    SMTP_APP_PASSWORD=xxxx xxxx xxxx xxxx
"""

import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

SMTP_EMAIL = os.getenv("SMTP_EMAIL", "uzhavanai@gmail.com")
SMTP_APP_PASSWORD = os.getenv("SMTP_APP_PASSWORD", "htbq uyst qocs hogd")
SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 465


def send_otp_email(to_email: str, otp_code: str, user_name: str = "Farmer") -> bool:
    """
    Send a 6-digit OTP verification email to the user.
    Returns True on success, False on failure.
    """
    if not SMTP_APP_PASSWORD:
        print("[Email] ⚠️ SMTP_APP_PASSWORD not set — skipping OTP email. "
              f"OTP for {to_email}: {otp_code}")
        return False

    subject = "Your UZHAVAN AI Verification Code"

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto;
                background: #ffffff; border-radius: 16px; overflow: hidden;
                box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #059669, #10b981); padding: 32px 24px;
                    text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; letter-spacing: 0.5px;">
                🌾 UZHAVAN AI
            </h1>
            <p style="color: #d1fae5; margin: 8px 0 0; font-size: 14px;">
                Smart Crop Disease Detection
            </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 8px;">
                Hello <strong>{user_name}</strong>,
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
                Use the code below to verify your UZHAVAN AI account.
                This code expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Code -->
            <div style="background: #f0fdf4; border: 2px dashed #10b981; border-radius: 12px;
                        padding: 20px; text-align: center; margin: 0 0 24px;">
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px;
                             color: #059669; font-family: 'Courier New', monospace;">
                    {otp_code}
                </span>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                If you didn't create an account, please ignore this email.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9fafb; padding: 16px 24px; text-align: center;
                    border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                &copy; 2026 UZHAVAN AI — Empowering Farmers with AI
            </p>
        </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"UZHAVAN AI <{SMTP_EMAIL}>"
    msg["To"] = to_email

    # Plain-text fallback
    plain = f"Hello {user_name},\n\nYour UZHAVAN AI verification code is: {otp_code}\n\nThis code expires in 10 minutes."
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"[Email] OTP sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Email] ❌ Failed to send OTP to {to_email}: {e}")
        return False


def send_forgot_password_otp_email(to_email: str, otp_code: str, user_name: str = "Farmer") -> bool:
    """
    Send a password-reset OTP email with a distinct amber/orange template.
    Returns True on success, False on failure.
    """
    if not SMTP_APP_PASSWORD:
        print("[Email] ⚠️ SMTP_APP_PASSWORD not set — skipping password-reset email. "
              f"Reset OTP for {to_email}: {otp_code}")
        return False

    subject = "UZHAVAN AI — Reset Your Password"

    html_body = f"""
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto;
                background: #ffffff; border-radius: 16px; overflow: hidden;
                box-shadow: 0 4px 24px rgba(0,0,0,0.08);">

        <!-- Header: amber gradient for password reset -->
        <div style="background: linear-gradient(135deg, #d97706, #f59e0b); padding: 32px 24px;
                    text-align: center;">
            <div style="font-size: 40px; margin-bottom: 8px;">🔐</div>
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; letter-spacing: 0.5px;">
                Password Reset Request
            </h1>
            <p style="color: #fef3c7; margin: 8px 0 0; font-size: 13px;">
                UZHAVAN AI — Smart Crop Disease Detection
            </p>
        </div>

        <!-- Body -->
        <div style="padding: 32px 24px;">
            <p style="color: #374151; font-size: 16px; margin: 0 0 6px;">
                Hello <strong>{user_name}</strong>,
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 8px;">
                We received a request to <strong>reset your password</strong> for your UZHAVAN AI account.
            </p>
            <p style="color: #6b7280; font-size: 14px; margin: 0 0 24px;">
                Use the code below to proceed. This code expires in <strong>10 minutes</strong>.
            </p>

            <!-- OTP Code — amber border to match the theme -->
            <div style="background: #fffbeb; border: 2px dashed #f59e0b; border-radius: 12px;
                        padding: 20px; text-align: center; margin: 0 0 24px;">
                <p style="color: #92400e; font-size: 11px; text-transform: uppercase;
                          letter-spacing: 2px; margin: 0 0 8px; font-weight: 600;">
                    Reset Code
                </p>
                <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px;
                             color: #d97706; font-family: 'Courier New', monospace;">
                    {otp_code}
                </span>
            </div>

            <!-- Security warning -->
            <div style="background: #fef2f2; border-left: 4px solid #f87171; border-radius: 8px;
                        padding: 12px 16px; margin: 0 0 16px;">
                <p style="color: #991b1b; font-size: 12px; margin: 0; font-weight: 600;">
                    🛡️ Security Notice
                </p>
                <p style="color: #b91c1c; font-size: 12px; margin: 4px 0 0;">
                    If you did not request a password reset, please ignore this email.
                    Your account remains secure.
                </p>
            </div>

            <p style="color: #9ca3af; font-size: 12px; margin: 0; text-align: center;">
                This code is valid for one-time use only.
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #fffbeb; padding: 16px 24px; text-align: center;
                    border-top: 1px solid #fde68a;">
            <p style="color: #92400e; font-size: 11px; margin: 0;">
                &copy; 2026 UZHAVAN AI — Empowering Farmers with AI
            </p>
        </div>
    </div>
    """

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"UZHAVAN AI <{SMTP_EMAIL}>"
    msg["To"] = to_email

    plain = (
        f"Hello {user_name},\n\n"
        f"Your UZHAVAN AI password reset code is: {otp_code}\n\n"
        f"This code expires in 10 minutes.\n\n"
        f"If you did not request this, please ignore this email."
    )
    msg.attach(MIMEText(plain, "plain"))
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL(SMTP_HOST, SMTP_PORT) as server:
            server.login(SMTP_EMAIL, SMTP_APP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to_email, msg.as_string())
        print(f"[Email] Password-reset OTP sent to {to_email}")
        return True
    except Exception as e:
        print(f"[Email] ❌ Failed to send reset OTP to {to_email}: {e}")
        return False
