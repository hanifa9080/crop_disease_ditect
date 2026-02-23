"""
Gemma 3 1B LLM service via llama-cpp-python.
Loads the GGUF model once at import time.
Provides disease report generation and general chat.
"""

import json
import re
from llama_cpp import Llama
import config

print(f"Loading Gemma LLM from: {config.GEMMA_PATH}")
try:
    llm = Llama(
        model_path=str(config.GEMMA_PATH),
        n_ctx=config.N_CTX,
        n_threads=config.N_THREADS,
        chat_format="gemma",
        verbose=False
    )
    print("Gemma LLM loaded successfully.")
except Exception as e:
    print(f"WARNING: Failed to load Gemma LLM: {e}")
    llm = None


def extract_json(text: str) -> dict:
    """Strip markdown fences and extract JSON object from LLM output."""
    text = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"Could not extract JSON from LLM response: {text[:200]}")


def _format_disease_name(raw: str) -> str:
    """'Tomato___Late_blight' → 'Tomato - Late blight'"""
    return raw.replace("___", " - ").replace("_", " ")


def generate_disease_report(disease_name: str, confidence: float) -> dict:
    """
    Generate a full disease analysis report from the classified disease name.
    Returns a dict matching the frontend PlantAnalysisResult interface.
    """
    display_name = _format_disease_name(disease_name)
    is_healthy = "healthy" in disease_name.lower()

    # Extract plant name from classification (e.g. "Tomato___Late_blight" → "Tomato")
    plant_name = disease_name.split("___")[0].replace("_", " ").replace(",", ", ")

    prompt = f"""You are UZHAVAN AI, a plant disease expert. A MobileNetV3 model classified a plant as: "{display_name}" with {confidence}% confidence.

Provide a JSON response with this EXACT structure:
{{
  "diagnosis": "A friendly summary of the plant's condition",
  "issues": {{
    "diseases": {{"detected": true/false, "details": "explanation"}},
    "pests": {{"detected": true/false, "details": "explanation"}},
    "underwatering": {{"detected": false, "details": "explanation"}},
    "overwatering": {{"detected": false, "details": "explanation"}},
    "soil": {{"detected": false, "details": "explanation"}},
    "sunlight": {{"detected": false, "details": "explanation"}},
    "nutrientDeficiency": {{"detected": false, "details": "explanation"}},
    "generalStress": {{"detected": false, "details": "explanation"}}
  }},
  "treatmentPlan": [
    {{"title": "Step title", "instruction": "Detailed instruction"}}
  ],
  "preventionTips": ["tip1", "tip2", "tip3"],
  "expertResources": [
    {{"title": "Article title", "description": "Why helpful", "url": ""}}
  ]
}}

{"The plant is healthy. Provide general care advice and mark all issues as not detected." if is_healthy else "Analyze the disease, mark relevant issues as detected, and provide treatment."}
Respond ONLY with valid JSON, no extra text."""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=800
        )

        raw = response["choices"][0]["message"]["content"]
        parsed = extract_json(raw)

        # Post-process expert resources to ensure valid URLs
        expert_resources = parsed.get("expertResources", [])
        if not expert_resources:
            expert_resources = [{
                "title": f"Guide to {display_name}",
                "description": f"Comprehensive information about identifying and treating {display_name}.",
                "url": ""
            }]
            
        for resource in expert_resources:
            # Generate a reliable Google Search URL
            query = f"{display_name} {resource.get('title', '')} treatment control".strip()
            # specific site restriction or general search
            resource["url"] = f"https://www.google.com/search?q={query.replace(' ', '+')}"

        # Build the full PlantAnalysisResult
        result = {
            "isPlant": True,
            "plantName": plant_name,
            "confidence": confidence,
            "alternatives": [],
            "diagnosis": parsed.get("diagnosis", f"Identified as {display_name}"),
            "issues": parsed.get("issues", _default_issues(is_healthy)),
            "treatmentPlan": parsed.get("treatmentPlan", []),
            "preventionTips": parsed.get("preventionTips", []),
            "expertResources": expert_resources,
        }
        return result

    except Exception as e:
        print(f"LLM Report Error: {e}")
        # Return a basic fallback result
        return _fallback_result(plant_name, display_name, confidence, is_healthy)


def generate_chat_response(message: str) -> str:
    """General agricultural chatbot - returns plain text response."""
    try:
        response = llm.create_chat_completion(
            messages=[
                {
                    "role": "user",
                    "content": f"You are UZHAVAN AI, a helpful agricultural expert assistant. "
                               f"Help with farming questions, plant care, and gardening tips. "
                               f"Be friendly and concise.\n\nUser: {message}"
                }
            ],
            temperature=0.3,
            max_tokens=400
        )
        return response["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"LLM Chat Error: {e}")
        return "I'm having trouble generating a response right now. Please try again."


def _default_issues(is_healthy: bool) -> dict:
    """Return default issues structure."""
    base = {
        "diseases": {"detected": False, "details": "No disease symptoms observed."},
        "pests": {"detected": False, "details": "No pest damage detected."},
        "underwatering": {"detected": False, "details": "Hydration looks adequate."},
        "overwatering": {"detected": False, "details": "No signs of overwatering."},
        "soil": {"detected": False, "details": "Soil conditions appear normal."},
        "sunlight": {"detected": False, "details": "Light exposure seems appropriate."},
        "nutrientDeficiency": {"detected": False, "details": "No nutrient deficiency signs."},
        "generalStress": {"detected": False, "details": "Plant appears healthy overall."},
    }
    if not is_healthy:
        base["diseases"]["detected"] = True
        base["diseases"]["details"] = "Disease symptoms detected by AI classification."
    return base


def _fallback_result(plant_name: str, display_name: str, confidence: float, is_healthy: bool) -> dict:
    """Fallback result when LLM fails."""
    return {
        "isPlant": True,
        "plantName": plant_name,
        "confidence": confidence,
        "alternatives": [],
        "diagnosis": f"Identified as {display_name}. {'The plant appears healthy.' if is_healthy else 'Disease detected - consider consulting a local agricultural expert.'}",
        "issues": _default_issues(is_healthy),
        "treatmentPlan": [] if is_healthy else [
            {"title": "Consult an expert", "instruction": "Visit your local agricultural extension office for specific treatment advice."},
            {"title": "Isolate affected plants", "instruction": "Separate diseased plants from healthy ones to prevent spread."}
        ],
        "preventionTips": [
            "Regularly inspect plants for early signs of disease",
            "Maintain proper spacing for air circulation",
            "Water at the base of plants, avoiding leaf wetness"
        ],
        "expertResources": [],
    }
