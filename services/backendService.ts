/**
 * Backend Service — calls the local FastAPI backend for all AI features.
 * Replaces geminiService.ts entirely.
 *
 * All endpoints use /api prefix which Vite proxies to http://localhost:8000
 */

const BACKEND_URL = "/api";

// ─────────── TypeScript Interfaces ───────────

export interface ClassificationResult {
    disease: string;
    confidence: number;
}

export interface IssueCheck {
    detected: boolean;
    details: string;
}

export interface PlantHealthIssues {
    diseases: IssueCheck;
    pests: IssueCheck;
    underwatering: IssueCheck;
    overwatering: IssueCheck;
    soil: IssueCheck;
    sunlight: IssueCheck;
    nutrientDeficiency: IssueCheck;
    generalStress: IssueCheck;
}

export interface TreatmentStep {
    title: string;
    instruction: string;
}

export interface ExternalResource {
    title: string;
    description: string;
    url: string;
}

export interface DiseaseReport {
    isPlant: boolean;
    plantName: string;
    diseaseName: string;
    confidence: number;
    alternatives: string[];
    issues: PlantHealthIssues;
    diagnosis: string;
    treatmentPlan: TreatmentStep[];
    preventionTips: string[];
    expertResources: ExternalResource[];
}

export interface CropInput {
    N: number;
    P: number;
    K: number;
    temperature: number;
    humidity: number;
    pH: number;
    rainfall: number;
}

export interface CropRecommendation {
    recommended_crop: string;
    reason: string;
    care_tips: string[];
}


// ─────────── API Functions ───────────

/**
 * Full analysis: MobileNetV3 classification + Gemma LLM report.
 * Returns PlantAnalysisResult[] (wrapped in {plants: []}).
 */
export const analyzeImage = async (base64Image: string): Promise<DiseaseReport[]> => {
    const response = await fetch(`${BACKEND_URL}/analyze-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Analysis failed" }));
        throw new Error(err.detail || "Failed to analyze plant image");
    }

    const data = await response.json();
    return data.plants as DiseaseReport[];
};


/**
 * Fast MobileNet-only classification (for AR live scanning).
 */
export const classifyImage = async (base64Image: string): Promise<ClassificationResult> => {
    const response = await fetch(`${BACKEND_URL}/classify-base64`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64Image }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Classification failed" }));
        throw new Error(err.detail || "Failed to classify plant image");
    }

    return response.json();
};


/**
 * Agricultural chatbot — sends full conversation history so Gemma has memory.
 */
export const chatWithBot = async (
    message: string,
    history: Array<{ role: 'user' | 'model'; content: string }> = [],
    sessionId?: string
): Promise<string> => {
    const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message, history, session_id: sessionId }),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Chat failed" }));
        throw new Error(err.detail || "Failed to get chat response");
    }

    const data = await response.json();
    return data.response;
};


/**
 * Crop recommendation based on soil and climate data.
 */
export const getCropRecommendation = async (data: CropInput): Promise<CropRecommendation> => {
    const response = await fetch(`${BACKEND_URL}/recommend`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ detail: "Recommendation failed" }));
        throw new Error(err.detail || "Failed to get crop recommendation");
    }

    return response.json();
};


/**
 * Health check — verify the backend is running.
 */
export const checkHealth = async (): Promise<{ status: string }> => {
    const response = await fetch(`${BACKEND_URL}/health`);
    if (!response.ok) {
        throw new Error("Backend health check failed");
    }
    return response.json();
};


// ─────────── Auth & History (MySQL-backed) ───────────

/**
 * Shared helper — always includes the HTTP-only cookie so the backend
 * can identify the logged-in user on every protected request.
 */
const authFetch = (url: string, opts: RequestInit = {}) =>
    fetch(`${BACKEND_URL}${url}`, { ...opts, credentials: 'include' });


// ── Auth ─────────────────────────────────────────────────────────────────────

/** Verify OTP code after registration. */
export const verifyOtp = async (email: string, otp: string): Promise<any> => {
    const r = await authFetch('/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp }),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({ detail: 'Verification failed' }));
        throw new Error(e.detail || 'Verification failed');
    }
    return r.json();
};

/** Resend a new OTP to the user's email. */
export const resendOtp = async (email: string): Promise<void> => {
    const r = await authFetch('/auth/resend-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: '' }),
    });
    if (!r.ok) {
        const e = await r.json().catch(() => ({ detail: 'Could not resend OTP' }));
        throw new Error(e.detail || 'Could not resend OTP');
    }
};


// ── History ───────────────────────────────────────────────────────────────────

/** Load all scan history for the logged-in user. */
export const fetchHistory = async (): Promise<any[]> => {
    const r = await authFetch('/history');
    if (!r.ok) throw new Error('Failed to load scan history');
    return (await r.json()).history;
};

/**
 * Save a completed scan to the database + write image to disk.
 * Call this AFTER analyzeImage() returns successfully.
 * @param image  base64 string (or null for AR scans that have no image)
 * @param results  array of DiseaseReport objects from the AI
 */
export const saveScanToDB = async (image: string | null, results: any[]): Promise<any> => {
    const r = await authFetch('/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, results }),
    });
    if (!r.ok) throw new Error('Failed to save scan');
    return r.json();
};

/** Delete a scan and its image file from disk. */
export const deleteScanFromDB = async (scanId: string): Promise<void> => {
    await authFetch(`/history/${scanId}`, { method: 'DELETE' });
};

/** Move a scan into a folder (pass null to ungroup it). */
export const moveScanFolder = async (scanId: string, folderId: string | null): Promise<void> => {
    await authFetch(`/history/${scanId}/folder`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folder_id: folderId }),
    });
};


// ── Folders ───────────────────────────────────────────────────────────────────

/** List all folders for the logged-in user. */
export const fetchFolders = async (): Promise<any[]> => {
    const r = await authFetch('/folders');
    if (!r.ok) throw new Error('Failed to load folders');
    return (await r.json()).folders;
};

/** Create a new folder and return it. */
export const createFolderInDB = async (name: string): Promise<any> => {
    const r = await authFetch('/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
    });
    if (!r.ok) throw new Error('Failed to create folder');
    return r.json();
};

/** Delete a folder (scans inside are ungrouped, not deleted). */
export const deleteFolderFromDB = async (folderId: string): Promise<void> => {
    await authFetch(`/folders/${folderId}`, { method: 'DELETE' });
};


// ── Chat History (persistent) ─────────────────────────────────────────────────

/**
 * Load persisted chat history for a session from MySQL.
 * Called on chat open to restore conversation after page refresh.
 * Returns empty array if session not found or user not logged in.
 */
export const fetchChatHistory = async (
    sessionId: string
): Promise<Array<{ role: 'user' | 'model'; content: string; timestamp: number }>> => {
    try {
        const r = await authFetch(`/chat/history?session_id=${encodeURIComponent(sessionId)}`);
        if (!r.ok) return [];
        const data = await r.json();
        return data.messages || [];
    } catch {
        return [];
    }
};


/**
 * Delete all messages for a session from the database.
 * Called when the farmer clicks the Clear Chat button.
 */
export const deleteChatHistory = async (sessionId: string): Promise<void> => {
    try {
        await authFetch('/chat/history', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ session_id: sessionId }),
        });
    } catch {
        // Silently ignore — UI already cleared
    }
};
