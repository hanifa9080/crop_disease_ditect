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


class ChatInput(BaseModel):
    message: str


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


# ── History ───────────────────────────────────────────────────────────────────

class SaveScanRequest(BaseModel):
    image: Optional[str] = None   # base64 — optional; AR scanner has no image
    results: List[Any]             # list of DiseaseReport dicts from the AI


# ── Folders ───────────────────────────────────────────────────────────────────

class CreateFolderRequest(BaseModel):
    name: str


class MoveFolderRequest(BaseModel):
    folder_id: Optional[str] = None  # None = remove from folder


# ── Admin ─────────────────────────────────────────────────────────────────────

class AdminLoginRequest(BaseModel):
    username: str
    password: str
