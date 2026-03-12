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
from pathlib import Path

from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import config
from database import init_db, get_connection
from schemas import (
    CropInput, ChatInput, Base64ImageRequest,
    RegisterRequest, LoginRequest, VerifyOtpRequest,
    ForgotPasswordRequest, ResetPasswordRequest, VerifyResetOtpRequest,
    SaveScanRequest, CreateFolderRequest, MoveFolderRequest,
    DeleteChatHistoryRequest,
)
from services.disease_detector import predict_disease
from services.llm_service import generate_disease_report, generate_chat_response
from services.crop_service import recommend_crop
from services.auth_service import (
    register_user, login_user, verify_otp, resend_otp,
    forgot_password_request, verify_reset_otp, reset_password_confirm,
    get_current_user,
)
from services.history_service import save_scan, get_history, delete_scan, UPLOAD_DIR
from services.folder_service import get_folders, create_folder, delete_folder


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
    """Agricultural chatbot with full conversation memory. Persists to MySQL."""
    try:
        # Convert Pydantic history to plain dicts for llm_service
        history_dicts = [{"role": h.role, "content": h.content} for h in req.history]
        reply = generate_chat_response(req.message, history=history_dicts)

        # Persist this turn to database
        try:
            user_id_cookie = request.cookies.get("user_id")
            conn = get_connection()
            cur = conn.cursor()
            # sequence_num = number of existing rows for this session + 1
            cur.execute(
                "SELECT COUNT(*) FROM chat_logs WHERE session_id = %s",
                (req.session_id,)
            )
            row = cur.fetchone()
            seq = (row[0] + 1) if row else 1
            cur.execute(
                """INSERT INTO chat_logs
                   (user_id, session_id, sequence_num, user_message, ai_response)
                   VALUES (%s, %s, %s, %s, %s)""",
                (user_id_cookie, req.session_id, seq,
                 req.message[:2000], reply[:2000])
            )
            conn.commit()
            cur.close(); conn.close()
        except Exception:
            pass  # DB failure must never break the chat response

        return {"response": reply}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.get("/chat/history")
async def get_chat_history(session_id: str, request: Request):
    """
    Load persisted chat history for a given session_id.
    Called by frontend on chat open to restore messages after page refresh.
    Returns messages ordered oldest-first, max 50 messages (25 turns).
    Only returns data if the session_id belongs to the requesting user.
    """
    user_id_cookie = request.cookies.get("user_id")
    if not user_id_cookie or not session_id:
        return {"session_id": None, "messages": []}
    try:
        conn = get_connection()
        cur = conn.cursor(dictionary=True)
        cur.execute(
            """SELECT user_message, ai_response, created_at, sequence_num
               FROM chat_logs
               WHERE session_id = %s AND user_id = %s
               ORDER BY sequence_num ASC, created_at ASC
               LIMIT 25""",
            (session_id, user_id_cookie)
        )
        rows = cur.fetchall()
        cur.close(); conn.close()

        if not rows:
            return {"session_id": None, "messages": []}

        # Reconstruct flat message list from (user_message, ai_response) pairs
        messages = []
        for row in rows:
            ts = int(row["created_at"].timestamp() * 1000)  # datetime → ms
            messages.append({
                "role":      "user",
                "content":   row["user_message"],
                "timestamp": ts,
            })
            messages.append({
                "role":      "model",
                "content":   row["ai_response"],
                "timestamp": ts + 1,
            })

        return {"session_id": session_id, "messages": messages}
    except Exception as e:
        print(f"[Chat] History load error: {e}")
        return {"session_id": None, "messages": []}


@app.delete("/chat/history")
async def delete_chat_history(req: DeleteChatHistoryRequest, request: Request):
    """
    Wipe all messages for a given session_id from the database.
    Called when the farmer clicks the 'Clear chat' button.
    Only deletes rows owned by the requesting user.
    """
    user_id_cookie = request.cookies.get("user_id")
    if not user_id_cookie:
        return {"deleted": 0}
    try:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute(
            "DELETE FROM chat_logs WHERE session_id = %s AND user_id = %s",
            (req.session_id, user_id_cookie)
        )
        deleted = cur.rowcount
        conn.commit()
        cur.close(); conn.close()
        return {"deleted": deleted}
    except Exception as e:
        print(f"[Chat] History delete error: {e}")
        return {"deleted": 0}


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
def auth_register(req: RegisterRequest):
    """Create account → send OTP email → return pending status."""
    try:
        result = register_user(req.name, req.email, req.password)
        # result = { status: "pending", email } — no cookie set yet
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/login")
def auth_login(req: LoginRequest):
    """Validate credentials → generate OTP → return pending status."""
    try:
        result = login_user(req.email, req.password)
        # result = { status: "pending", email } — no cookie set yet
        return result
    except ValueError as e:
        raise HTTPException(status_code=401, detail=str(e))


@app.post("/auth/logout")
def auth_logout(response: Response):
    """Clear the session cookie."""
    response.delete_cookie("user_id", path="/")
    return {"status": "logged out"}


@app.post("/auth/verify-otp")
def auth_verify_otp(req: VerifyOtpRequest, response: Response):
    """Verify OTP code → activate user → set HTTP-only cookie."""
    try:
        user = verify_otp(req.email, req.otp)
        response.set_cookie(
            key="user_id", value=user["id"],
            httponly=True, samesite="lax", path="/"
        )
        return user
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/resend-otp")
def auth_resend_otp(req: VerifyOtpRequest):
    """Resend a new OTP to the user's email."""
    try:
        return resend_otp(req.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/auth/me")
def auth_me(user: dict = Depends(get_current_user)):
    """Return the currently logged-in user from cookie."""
    return user


@app.post("/auth/forgot-password")
def auth_forgot_password(req: ForgotPasswordRequest):
    """
    Step 1 of password reset — send an OTP to the given email.
    Returns 400 if the email is not found or not yet verified.
    """
    try:
        return forgot_password_request(req.email)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/verify-reset-otp")
def auth_verify_reset_otp(req: VerifyResetOtpRequest):
    """
    Step 2 of password reset: confirm the OTP is correct and not expired.
    Does NOT clear the OTP — that happens when the new password is saved.
    """
    try:
        return verify_reset_otp(req.email, req.otp)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/auth/reset-password")
def auth_reset_password(req: ResetPasswordRequest):
    """
    Step 3 of password reset: verify OTP a final time and set the new password.
    """
    try:
        return reset_password_confirm(req.email, req.otp, req.new_password)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


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




# ── Entry Point ───────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
