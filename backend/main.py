"""
FastAPI application — UZHAVAN AI Disease Detection & Crop Advisory.

Endpoints:
  • Disease analysis  (/analyze, /analyze-base64, /classify, /classify-base64)
  • Chat              (/chat)
  • Crop Recommendation (/recommend)
  • Auth              (/auth/register, /auth/login, /auth/logout, /auth/me)
  • History           (/history  GET/POST/DELETE/PATCH)
  • Folders           (/folders  GET/POST/DELETE)
  • Static uploads    (/uploads/...)
"""

import base64
import time
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Response, Cookie, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from database import init_db, get_connection
from schemas import (
    CropInput, ChatInput, Base64ImageRequest,
    RegisterRequest, LoginRequest,
    SaveScanRequest, CreateFolderRequest, MoveFolderRequest,
    AdminLoginRequest,
)
from services.disease_detector import predict_disease
from services.llm_service import generate_disease_report, generate_chat_response
from services.crop_service import recommend_crop
from services.auth_service import register_user, login_user, get_current_user
from services.history_service import save_scan, get_history, delete_scan, UPLOAD_DIR
from services.folder_service import get_folders, create_folder, delete_folder
from services.admin_service import (
    login_admin, get_current_admin, get_user_stats, get_scan_stats,
    get_performance_metrics, get_chat_logs, get_error_logs,
    disable_user, enable_user, log_system_event
)
from services.monitoring_service import log_request

app = FastAPI(title="UZHAVAN AI - Local AI Backend")

# ── CORS ──────────────────────────────────────────────────────────────────────
# Must be an exact origin (not "*") for HTTP-only cookies to work.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],   # Vite dev server port
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def monitoring_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    duration_ms = (time.time() - start) * 1000
    user_id = request.cookies.get("user_id")
    log_request(
        endpoint=str(request.url.path),
        method=request.method,
        status_code=response.status_code,
        response_time_ms=round(duration_ms, 2),
        user_id=user_id
    )
    return response


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def startup_event():
    init_db()                         # auto-creates uzhavan_ai DB + all 4 tables
    UPLOAD_DIR.mkdir(exist_ok=True)   # ensure uploads folder exists
    print("[main] UZHAVAN AI backend ready.")


# Serve saved plant images at /uploads/{user_id}/{filename}
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


# ── Health Check ──────────────────────────────────────────────────────────────
@app.get("/health")
async def health():
    return {"status": "ok", "classes": config.NUM_CLASSES}


# ── Full Analysis (MobileNet + LLM) ──────────────────────────────────────────
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


# ── Fast Classification (MobileNet only) ─────────────────────────────────────
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


# ── Chat ──────────────────────────────────────────────────────────────────────
@app.post("/chat")
async def chat(req: ChatInput, request: Request):
    """Agricultural chatbot powered by local Gemma LLM."""
    try:
        reply = generate_chat_response(req.message)
        # Log chat to database
        try:
            user_id_cookie = request.cookies.get("user_id")
            conn = get_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO chat_logs (user_id, user_message, ai_response) VALUES (%s,%s,%s)",
                (user_id_cookie, req.message[:2000], reply[:2000])
            )
            conn.commit()
            cur.close(); conn.close()
        except Exception:
            pass
        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


# ── Crop Recommendation ───────────────────────────────────────────────────────
@app.post("/recommend")
async def recommend(data: CropInput):
    """Crop recommendation based on soil and climate parameters."""
    try:
        return recommend_crop(data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Recommendation failed: {str(e)}")


# ── Legacy Compatibility Endpoints ────────────────────────────────────────────
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


# ── Auth Routes ───────────────────────────────────────────────────────────────

@app.post("/auth/register")
def auth_register(req: RegisterRequest, response: Response):
    """Create account → set HTTP-only cookie with user_id."""
    try:
        user = register_user(req.name, req.email, req.password)
        response.set_cookie(
            key="user_id", value=user["id"],
            httponly=True, samesite="lax", path="/"
        )
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def auth_login(req: LoginRequest, response: Response):
    """Validate credentials → set HTTP-only cookie with user_id."""
    try:
        user = login_user(req.email, req.password)
        response.set_cookie(
            key="user_id", value=user["id"],
            httponly=True, samesite="lax", path="/"
        )
        # Log successful login
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("INSERT INTO login_attempts (user_id, email, success) VALUES (%s,%s,%s)",
                        (user["id"], req.email, True))
            conn.commit()
            cur.close(); conn.close()
        except Exception:
            pass
        return user
    except ValueError as e:
        # Log failed login
        try:
            conn = get_connection()
            cur = conn.cursor()
            cur.execute("INSERT INTO login_attempts (user_id, email, success) VALUES (%s,%s,%s)",
                        (None, req.email, False))
            conn.commit()
            cur.close(); conn.close()
        except Exception:
            pass
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/auth/logout")
def auth_logout(response: Response):
    """Clear the session cookie."""
    response.delete_cookie("user_id", path="/")
    return {"status": "logged out"}


@app.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """Return the currently logged-in user from cookie."""
    return user


# ── History Routes ────────────────────────────────────────────────────────────

@app.get("/history")
def history_get(user: dict = Depends(get_current_user)):
    """Fetch all scans for the logged-in user, newest first."""
    return {"history": get_history(user["id"])}


@app.post("/history")
def history_post(req: SaveScanRequest, user: dict = Depends(get_current_user)):
    """Save a scan + image to disk and MySQL after AI analysis."""
    return save_scan(user["id"], req.image, req.results)


@app.delete("/history/{scan_id}")
def history_delete(scan_id: str, user: dict = Depends(get_current_user)):
    """Delete a scan and its image file."""
    if not delete_scan(scan_id, user["id"]):
        raise HTTPException(status_code=404, detail="Scan not found")
    return {"deleted": scan_id}


@app.patch("/history/{scan_id}/folder")
def history_move_folder(
    scan_id: str,
    req: MoveFolderRequest,
    user: dict = Depends(get_current_user),
):
    """Move a scan into a folder (or pass folder_id=null to ungroup it)."""
    conn = get_connection()
    cur  = conn.cursor()
    try:
        cur.execute(
            "UPDATE scan_history SET folder_id=%s WHERE id=%s AND user_id=%s",
            (req.folder_id, scan_id, user["id"]),
        )
        conn.commit()
    finally:
        cur.close()
        conn.close()
    return {"status": "moved"}


# ── Folder Routes ─────────────────────────────────────────────────────────────

@app.get("/folders")
def folders_get(user: dict = Depends(get_current_user)):
    """List all folders for the logged-in user."""
    return {"folders": get_folders(user["id"])}


@app.post("/folders")
def folders_post(req: CreateFolderRequest, user: dict = Depends(get_current_user)):
    """Create a new folder."""
    return create_folder(user["id"], req.name)


@app.delete("/folders/{folder_id}")
def folders_delete(folder_id: str, user: dict = Depends(get_current_user)):
    """Delete a folder — scans inside are ungrouped, not deleted."""
    delete_folder(folder_id, user["id"])
    return {"deleted": folder_id}


# ══════════════════════════════════════════════════
# ADMIN ROUTES
# ══════════════════════════════════════════════════

def _get_admin(admin_id: str = Cookie(None)):
    if not admin_id:
        raise HTTPException(status_code=401, detail="Admin not logged in")
    admin = get_current_admin(admin_id)
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin session")
    return admin


@app.post("/admin/login")
def admin_login(req: AdminLoginRequest, response: Response):
    try:
        admin = login_admin(req.username, req.password)
        response.set_cookie(key="admin_id", value=admin["id"], httponly=True, samesite="lax", path="/")
        return admin
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/admin/logout")
def admin_logout(response: Response):
    response.delete_cookie("admin_id", path="/")
    return {"status": "logged out"}


@app.get("/admin/me")
def admin_me(admin: dict = Depends(_get_admin)):
    return admin


@app.get("/admin/users")
def admin_users(admin: dict = Depends(_get_admin)):
    return get_user_stats()


@app.get("/admin/scans")
def admin_scans(admin: dict = Depends(_get_admin)):
    return get_scan_stats()


@app.get("/admin/metrics")
def admin_metrics(admin: dict = Depends(_get_admin)):
    return get_performance_metrics()


@app.get("/admin/chats")
def admin_chats(admin: dict = Depends(_get_admin)):
    return get_chat_logs()


@app.get("/admin/errors")
def admin_errors(admin: dict = Depends(_get_admin)):
    return get_error_logs()


@app.post("/admin/users/{user_id}/disable")
def admin_disable(user_id: str, req: dict, admin: dict = Depends(_get_admin)):
    disable_user(user_id, req.get("reason", "Disabled by admin"), admin["id"])
    return {"status": "disabled"}


@app.post("/admin/users/{user_id}/enable")
def admin_enable(user_id: str, admin: dict = Depends(_get_admin)):
    enable_user(user_id)
    return {"status": "enabled"}


# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
