"""
FastAPI application — FloroNova / UZHAVAN AI Disease Detection & Crop Advisory.
Endpoints for disease analysis, classification, chat, and crop recommendation.
"""

import base64
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import config
from schemas import CropInput, ChatInput, Base64ImageRequest
from services.disease_detector import predict_disease
from services.llm_service import generate_disease_report, generate_chat_response
from services.crop_service import recommend_crop

app = FastAPI(title="UZHAVAN AI - Local AI Backend")

# CORS — allow all origins for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──────────────────── Health Check ────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "classes": config.NUM_CLASSES}


# ──────────────────── Full Analysis (MobileNet + LLM) ────────────────────
@app.post("/analyze")
async def analyze_upload(file: UploadFile = File(...)):
    """Full pipeline: MobileNet classification → Gemma LLM report (file upload)."""
    if file.size and file.size > config.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    image_bytes = await file.read()
    try:
        classification = predict_disease(image_bytes)
        report = generate_disease_report(classification["disease"], classification["confidence"])
        return {"plants": [report]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


@app.post("/analyze-base64")
async def analyze_base64(req: Base64ImageRequest):
    """Full pipeline: MobileNet classification → Gemma LLM report (base64 input)."""
    try:
        b64 = req.image
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)

        classification = predict_disease(image_bytes)
        report = generate_disease_report(classification["disease"], classification["confidence"])
        return {"plants": [report]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")


# ──────────────────── Fast Classification (MobileNet only) ────────────────────
@app.post("/classify")
async def classify_upload(file: UploadFile = File(...)):
    """Fast MobileNet-only classification (for AR live scanning)."""
    if file.size and file.size > config.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")

    image_bytes = await file.read()
    try:
        return predict_disease(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


@app.post("/classify-base64")
async def classify_base64(req: Base64ImageRequest):
    """Fast MobileNet-only classification (base64 input, for AR)."""
    try:
        b64 = req.image
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)
        return predict_disease(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Classification failed: {str(e)}")


# ──────────────────── Keep old endpoints for backward compat ────────────────────
@app.get("/api/health")
async def health_compat():
    return {"status": "ok", "classes": config.NUM_CLASSES}


@app.post("/api/predict")
async def predict_upload_compat(file: UploadFile = File(...)):
    """Legacy endpoint — same as /classify."""
    if file.size and file.size > config.MAX_IMAGE_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large")
    image_bytes = await file.read()
    try:
        return predict_disease(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


@app.post("/api/predict-base64")
async def predict_base64_compat(req: Base64ImageRequest):
    """Legacy endpoint — same as /classify-base64."""
    try:
        b64 = req.image
        if "," in b64:
            b64 = b64.split(",", 1)[1]
        image_bytes = base64.b64decode(b64)
        return predict_disease(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")


# ──────────────────── Chat ────────────────────
@app.post("/chat")
async def chat(req: ChatInput):
    """Agricultural chatbot powered by local Gemma LLM."""
    try:
        response_text = generate_chat_response(req.message)
        return {"response": response_text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ──────────────────── Crop Recommendation ────────────────────
@app.post("/recommend")
async def recommend(data: CropInput):
    """Crop recommendation based on soil/climate parameters."""
    try:
        return recommend_crop(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")


# ──────────────────── Entry Point ────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
