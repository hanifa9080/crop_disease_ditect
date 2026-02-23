from pydantic import BaseModel


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
