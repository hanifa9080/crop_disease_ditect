from pydantic import BaseModel
from typing import Optional, List, Any


# ── Existing Models (unchanged) ───────────────────────────────────────────────

class CropInput(BaseModel):
    N: float
    P: float
    K: float
    temperature: float
    humidity: float
    pH: float
    rainfall: float


class ChatHistoryMessage(BaseModel):
    """One turn in the conversation history sent from the frontend."""
    role: str     # 'user' or 'model'
    content: str  # the message text


class ChatInput(BaseModel):
    message: str
    history: List[ChatHistoryMessage] = []   # all previous turns, oldest first
    session_id: Optional[str] = None         # UUID from localStorage


class DeleteChatHistoryRequest(BaseModel):
    session_id: str   # which session to wipe from the database


class Base64ImageRequest(BaseModel):
    image: str  # base64-encoded image (may include data URL prefix)


# ── Auth ──────────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class VerifyOtpRequest(BaseModel):
    email: str
    otp:   str


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetPasswordRequest(BaseModel):
    email:        str
    otp:          str
    new_password: str


class VerifyResetOtpRequest(BaseModel):
    """Used at step 2 of the forgot-password flow to validate the OTP before asking for new password."""
    email: str
    otp:   str


# ── History ───────────────────────────────────────────────────────────────────

class SaveScanRequest(BaseModel):
    image: Optional[str] = None   # base64 — optional; AR scanner has no image
    results: List[Any]             # list of DiseaseReport dicts from the AI


# ── Folders ───────────────────────────────────────────────────────────────────

class CreateFolderRequest(BaseModel):
    name: str


class MoveFolderRequest(BaseModel):
    folder_id: Optional[str] = None  # None = remove from folder

