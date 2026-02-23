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
 * Agricultural chatbot — stateless text-only interaction via Gemma LLM.
 */
export const chatWithBot = async (message: string): Promise<string> => {
    const response = await fetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
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
