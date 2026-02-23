import { GoogleGenAI, Type, Schema, Chat } from "@google/genai";
import { PlantAnalysisResult, ChatMessage, ChatSource, ARDetection, ARDetailedReport } from "../types";
import { classifyImage } from "./backendService";

// ============================================================
// Schemas (same as before — Gemini returns structured JSON)
// ============================================================

const issueCheckSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    detected: { type: Type.BOOLEAN, description: "Whether this specific issue is present." },
    details: { type: Type.STRING, description: "A brief, friendly explanation of what was observed regarding this issue." },
  },
  required: ["detected", "details"],
};

const singlePlantSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    isPlant: { type: Type.BOOLEAN, description: "Set to true since we already identified a plant." },
    plantName: { type: Type.STRING, description: "The common name of the plant." },
    confidence: { type: Type.NUMBER, description: "Confidence level of identification from 0 to 100." },
    alternatives: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "List of other possible plant names if identification is not 100% certain."
    },
    issues: {
      type: Type.OBJECT,
      properties: {
        diseases: issueCheckSchema,
        pests: issueCheckSchema,
        underwatering: issueCheckSchema,
        overwatering: issueCheckSchema,
        soil: issueCheckSchema,
        sunlight: issueCheckSchema,
        nutrientDeficiency: issueCheckSchema,
        generalStress: issueCheckSchema,
      },
      required: ["diseases", "pests", "underwatering", "overwatering", "soil", "sunlight", "nutrientDeficiency", "generalStress"],
    },
    diagnosis: { type: Type.STRING, description: "A friendly, easy-to-understand summary of what is happening to THIS specific plant and why." },
    treatmentPlan: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Short title of the step (e.g., 'Prune affected leaves')." },
          instruction: { type: Type.STRING, description: "Clear, practical instruction on how to perform the step." },
        },
        required: ["title", "instruction"],
      },
      description: "A step-by-step guide to fixing the issues, prioritizing organic and safe methods."
    },
    preventionTips: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Simple care habits to prevent future issues."
    },
    expertResources: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING, description: "Title of a recommended blog post or article from a reputable source." },
          description: { type: Type.STRING, description: "Brief reason why this article is helpful." },
          url: { type: Type.STRING, description: "The URL to the article. If unknown, leave empty." },
        },
        required: ["title", "description", "url"],
      },
      description: "List of 2-3 specific, high-quality articles or blogs relevant to this plant's care or current issues."
    }
  },
  required: ["isPlant", "plantName", "confidence", "issues", "diagnosis", "treatmentPlan", "preventionTips", "expertResources"],
};

const multiAnalysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    plants: {
      type: Type.ARRAY,
      items: singlePlantSchema,
      description: "A list of all distinct plants identified in the image."
    }
  },
  required: ["plants"]
};

// Detailed Report Schema (for AR)
const detailedReportSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    disease_name: { type: Type.STRING, description: "The most likely disease(s) detected." },
    confidence_score: { type: Type.NUMBER, description: "Percentage of certainty 0-100." },
    affected_area_description: { type: Type.STRING, description: "Describe which parts of the leaf/plant are affected." },
    symptoms_observed: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List all visible symptoms." },
    possible_causes: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Environmental and biological causes." },
    severity_level: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
    immediate_actions: { type: Type.ARRAY, items: { type: Type.STRING }, description: "What the user should do right now." },
    long_term_prevention: { type: Type.ARRAY, items: { type: Type.STRING }, description: "What to do to avoid this disease." },
    care_score: { type: Type.NUMBER, description: "Rate the overall plant health from 1 to 10." },
    time_to_recovery: { type: Type.STRING, description: "Approximate recovery days/weeks." }
  },
  required: ["disease_name", "confidence_score", "affected_area_description", "symptoms_observed", "possible_causes", "severity_level", "immediate_actions", "long_term_prevention", "care_score", "time_to_recovery"]
};


// ============================================================
// Helper — format disease name for display
// ============================================================
function formatDiseaseName(raw: string): string {
  // "Tomato___Late_blight" → "Tomato - Late blight"
  return raw.replace(/___/g, " - ").replace(/_/g, " ");
}


// ============================================================
// analyzePlantImage — MODIFIED
//   Step 1: MobileNetV3 classifies disease (via backend)
//   Step 2: Gemini API generates detailed analysis from disease name
// ============================================================
export const analyzePlantImage = async (base64Image: string): Promise<PlantAnalysisResult[]> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("Gemini API Key is missing. Please check your environment configuration.");
  }

  // Step 1: Classify with MobileNetV3
  const classification = await classifyImage(base64Image);
  const diseaseName = formatDiseaseName(classification.disease);
  const isHealthy = classification.disease.toLowerCase().includes("healthy");

  // Step 2: Send disease name to Gemini for detailed analysis (text-only, no image)
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            text: `The plant has been identified by our AI model as: "${diseaseName}" with ${classification.confidence}% confidence.

Based on this identification, provide a comprehensive health analysis for this plant. The plant name should be extracted from the classification (e.g., "Tomato" from "Tomato - Late blight"). If the plant is classified as healthy, still provide general care advice.

Be a gentle, helpful plant expert.`,
          },
        ],
      },
      config: {
        systemInstruction: "You are UZHAVAN AI, a knowledgeable crop disease expert. The plant has already been identified by a MobileNetV3 AI model. Your job is to provide detailed health analysis, diagnosis, treatment plans, and prevention tips based on the classification. Use a warm and supportive tone. Avoid jargon.",
        responseMimeType: "application/json",
        responseSchema: multiAnalysisSchema,
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response received from the analysis service.");
    }

    const result = JSON.parse(text);
    return result.plants as PlantAnalysisResult[];

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error("Failed to analyze the plant. Please try again.");
  }
};


// ============================================================
// scanPlantAR — MODIFIED
//   Sends camera frame to MobileNetV3 for classification
//   Returns a single detection covering the full frame
// ============================================================
export const scanPlantAR = async (base64Image: string): Promise<ARDetection[]> => {
  try {
    const classification = await classifyImage(base64Image);
    const diseaseName = formatDiseaseName(classification.disease);
    const isHealthy = classification.disease.toLowerCase().includes("healthy");

    // Determine issue type from disease name
    let type: ARDetection['type'] = 'unknown';
    if (isHealthy) {
      type = 'healthy';
    } else if (classification.disease.toLowerCase().includes('blight') ||
      classification.disease.toLowerCase().includes('rot') ||
      classification.disease.toLowerCase().includes('spot') ||
      classification.disease.toLowerCase().includes('mold') ||
      classification.disease.toLowerCase().includes('virus') ||
      classification.disease.toLowerCase().includes('scorch') ||
      classification.disease.toLowerCase().includes('rust') ||
      classification.disease.toLowerCase().includes('measles') ||
      classification.disease.toLowerCase().includes('greening')) {
      type = 'disease';
    } else if (classification.disease.toLowerCase().includes('spider_mite') ||
      classification.disease.toLowerCase().includes('pest')) {
      type = 'pest';
    } else if (classification.disease.toLowerCase().includes('nutrient') ||
      classification.disease.toLowerCase().includes('deficiency')) {
      type = 'nutrient';
    }

    // Return single detection covering the full frame (MobileNetV3 is a classifier, not a detector)
    return [{
      label: diseaseName,
      type: type,
      confidence: classification.confidence,
      box_2d: [50, 50, 950, 950], // Near full-frame bounding box
    }];
  } catch (error) {
    console.error("AR Scan Error:", error);
    return [];
  }
};


// ============================================================
// generateDetailedARReport — MODIFIED
//   Step 1: MobileNetV3 classifies disease
//   Step 2: Gemini generates detailed report from disease name
// ============================================================
export const generateDetailedARReport = async (base64Image: string): Promise<ARDetailedReport> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("Gemini API Key missing");

  // Step 1: Classify with MobileNetV3
  const classification = await classifyImage(base64Image);
  const diseaseName = formatDiseaseName(classification.disease);

  // Step 2: Gemini generates detailed report from disease name (text-only, no image)
  const ai = new GoogleGenAI({ apiKey });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            text: `Our AI model has classified a plant as: "${diseaseName}" with ${classification.confidence}% confidence.

Provide a comprehensive plant disease report based on this classification. Include symptoms, causes, severity, immediate actions, and long-term prevention.`,
          },
        ],
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: detailedReportSchema,
        systemInstruction: "You are an expert plant-disease detection assistant. A MobileNetV3 AI model has already classified the plant disease. Provide a detailed, comprehensive report based on the classification result. If the plant is healthy, provide a health report. Do not ask questions. Direct analysis only.",
      },
    });

    const text = response.text;
    if (!text) throw new Error("No report generated");

    return JSON.parse(text) as ARDetailedReport;
  } catch (error) {
    console.error("Detailed Report Error:", error);
    throw error;
  }
};


// ============================================================
// Chat functions — unchanged (still use Gemini API directly)
// ============================================================
export const createChatSession = (): Chat => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing.");
  }
  const ai = new GoogleGenAI({ apiKey });
  return ai.chats.create({
    model: 'gemini-2.5-flash',
    config: {
      systemInstruction: "You are UZHAVAN AI's intelligent assistant. Help users with farming questions, plant identification tips, and crop care advice. You have access to Google Search to find real-time information. Always provide helpful, friendly, and scientifically accurate information. If you use external sources, they will be automatically cited, so just focus on the answer.",
      tools: [{ googleSearch: {} }],
    },
  });
};

export const sendChatMessage = async (chat: Chat, message: string, image?: string): Promise<Omit<ChatMessage, 'id' | 'timestamp' | 'role'>> => {
  try {
    let content: any = message;

    if (image) {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
      content = [
        { text: message || "Analyze this image." },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data
          }
        }
      ];
    }

    const response = await chat.sendMessage({ message: content });
    const text = response.text || "I'm sorry, I couldn't generate a response.";

    const sources: ChatSource[] = [];
    const candidates = response.candidates;
    if (candidates && candidates[0] && candidates[0].groundingMetadata && candidates[0].groundingMetadata.groundingChunks) {
      candidates[0].groundingMetadata.groundingChunks.forEach((chunk: any) => {
        if (chunk.web) {
          sources.push({
            title: chunk.web.title,
            uri: chunk.web.uri
          });
        }
      });
    }

    return { text, sources };
  } catch (error) {
    console.error("Chat Error:", error);
    throw new Error("Failed to send message.");
  }
};