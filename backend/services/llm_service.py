"""
Gemma 3 1B LLM service via llama-cpp-python.
Loads the GGUF model once at import time.
Provides disease report generation and general chat.
"""

import json
import os
import re
from llama_cpp import Llama
import config

print(f"Loading Gemma LLM from: {config.GEMMA_PATH}")
_gemma_path = str(config.GEMMA_PATH)

# Check file existence and size first
import os as _os
if not _os.path.isfile(_gemma_path):
    print(f"WARNING: Gemma model file does NOT exist at: {_gemma_path}")
    llm = None
else:
    _fsize = _os.path.getsize(_gemma_path)
    print(f"  Model file found. Size: {_fsize / (1024*1024):.1f} MB")
    try:
        # NOTE: Do NOT pass chat_format="gemma" — it crashes llama-cpp-python v0.3.x.
        # The Gemma 3 GGUF model auto-detects its chat template from metadata.
        llm = Llama(
            model_path=_gemma_path,
            n_ctx=config.N_CTX,
            n_batch=getattr(config, "N_BATCH", 512),
            n_threads=config.N_THREADS,
            verbose=False,
        )
        print("  Gemma LLM loaded successfully.")
    except Exception as e:
        print(f"  ERROR loading Gemma LLM: {e}")
        llm = None

if llm is None:
    print("WARNING: Gemma LLM is not available. Disease reports will use KB-only mode.")


# Normalize a key so KB lookups always match regardless of parens, commas, or spaces
def _normalize_key(raw: str) -> str:
    """Remove parentheses & commas, replace spaces with underscores."""
    return raw.replace('(', '').replace(')', '').replace(',', '').replace(' ', '_')


# Load disease knowledge base once at startup
_KB_PATH = os.path.join(os.path.dirname(__file__), '..', 'data', 'disease_knowledge.json')
try:
    with open(_KB_PATH, 'r') as f:
        _raw_diseases = json.load(f)['diseases']
    # Build lookup with BOTH original key AND normalized key so either matches
    _DISEASE_KB = {}
    for d in _raw_diseases:
        _DISEASE_KB[d['class_id']] = d
        _DISEASE_KB[_normalize_key(d['class_id'])] = d
    print(f"[LLM] Disease KB loaded: {len(_raw_diseases)} entries ({len(_DISEASE_KB)} lookup keys)")
except Exception as e:
    _DISEASE_KB = {}
    print(f"[LLM] Warning: Could not load disease KB: {e}")

SYSTEM_KNOWLEDGE = """You are UZHAVAN AI, an agricultural assistant built into a crop disease detection app.

WHAT THIS APP DOES:
- Detects 27 plant diseases using MobileNetV3 AI model (offline, no internet required)
- Provides treatment plans, prevention tips, and expert resources for each disease
- Supports camera capture mode and image upload mode
- Saves scan history in a MySQL database linked to your account

SUPPORTED CROPS AND DISEASES:
- Corn: Cercospora Leaf Spot, Common Rust, Northern Leaf Blight, Healthy
- Grape: Black Rot, Esca (Black Measles), Leaf Blight, Healthy
- Orange: Huanglongbing (Citrus Greening)
- Peach: Bacterial Spot, Healthy
- Bell Pepper: Bacterial Spot, Healthy
- Potato: Early Blight, Late Blight, Healthy
- Raspberry: Healthy
- Soybean: Healthy
- Squash: Powdery Mildew
- Strawberry: Leaf Scorch, Healthy
- Tomato: Bacterial Spot, Early Blight, Late Blight, Leaf Mold, Septoria Leaf Spot,
           Spider Mites, Target Spot, Yellow Leaf Curl Virus, Mosaic Virus, Healthy

HOW TO USE THE APP:
- Upload a clear photo of a single plant leaf for best results
- Use Camera Capture to take a photo directly with your device camera
- Check History tab to view previous scans
- Use Crop Advice tab for soil-based recommendations

RESPONSE RULES:
- ONLY answer questions about agriculture, crops, farming, plant diseases, soil, irrigation
- If asked about unrelated topics say: I am designed to help only with agriculture and crop-related questions.
- Do NOT hallucinate disease names or treatments
- Be concise, accurate, and helpful
- If user writes in Tanglish (Tamil in English letters), understand and respond in simple English
"""

AGRI_KEYWORDS = [
    "crop","plant","leaf","leaves","soil","water","fertilizer","pest",
    "disease","irrigation","harvest","rice","wheat","tomato","corn",
    "chilli","farmer","yield","seed","fungus","bacteria","virus",
    "blight","rot","spot","mildew","rust","uzhavan","scan","diagnosis",
    "treatment","spray","fungicide","pesticide","organic","garden",
    "agriculture","farm","field","paddy","vegetable","fruit","tree",
    "potato","grape","pepper","strawberry","soybean","squash","orange",
    "peach","raspberry","healthy","detect","identify","how",
    "what","which","help","explain","tell","show","history","camera",
    "photo","image","upload","app","system","work","use","feature"
]

def is_agriculture_related(text: str) -> bool:
    text_lower = text.lower()
    return any(word in text_lower for word in AGRI_KEYWORDS)


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


def _build_kb_diagnosis(display_name: str, plant_name: str, kb_entry: dict,
                        is_healthy: bool, confidence: float) -> str:
    """Build a guaranteed real diagnosis string from knowledge base. Never uses LLM."""
    if is_healthy:
        return (f"{plant_name} appears healthy with no disease symptoms detected. "
                f"AI confidence: {confidence:.1f}%. "
                f"Continue regular monitoring and maintain proper care practices.")
    if kb_entry:
        severity   = kb_entry.get('severity', 'significant')
        causes     = kb_entry.get('causes', [])
        symptoms   = kb_entry.get('symptoms', [])
        treatments = kb_entry.get('treatment', [])
        cause_str   = causes[0]     if causes     else "a pathogen"
        symptom_str = symptoms[0]   if symptoms   else "visible disease symptoms"
        treat_str   = treatments[0] if treatments else "consult a local agricultural expert"
        return (f"Identified as {display_name} with {confidence:.1f}% confidence. "
                f"This is a {severity.lower()} severity condition caused by {cause_str}. "
                f"{symptom_str}. Recommended action: {treat_str}.")
    return (f"Identified as {display_name} with {confidence:.1f}% confidence. "
            f"Disease symptoms detected — please consult a local agricultural expert.")


def _build_expert_resources(display_name: str, kb_entry: dict) -> list:
    """Build expert resources from KB; fall back to Google search link."""
    kb_resources = kb_entry.get("expert_resources", []) if kb_entry else []
    if kb_resources:
        return [
            {
                "title": r["title"],
                "description": f"Expert guidance on {display_name}",
                "url": r["url"]
            }
            for r in kb_resources
        ]
    query = f"{display_name} disease treatment management".replace(" ", "+")
    return [
        {
            "title": f"Search: {display_name} Treatment Guide",
            "description": f"Find expert guidance on identifying and treating {display_name}.",
            "url": f"https://www.google.com/search?q={query}"
        }
    ]


def _build_kb_treatment_plan(kb_entry: dict, is_healthy: bool) -> list:
    """Build treatment plan from KB data when LLM is unavailable."""
    if is_healthy:
        return []
    treatments = kb_entry.get('treatment', []) if kb_entry else []
    plan = []
    titles = ["Immediate Treatment", "Follow-up Treatment", "Ongoing Monitoring"]
    for i, title in enumerate(titles):
        if i < len(treatments):
            plan.append({"title": title, "instruction": treatments[i]})
    if not plan:
        plan = [
            {"title": "Consult an expert", "instruction": "Visit your local agricultural extension office for specific treatment advice."},
            {"title": "Isolate affected plants", "instruction": "Separate diseased plants from healthy ones to prevent spread."}
        ]
    return plan


def generate_disease_report(disease_name: str, confidence: float) -> dict:
    display_name = _format_disease_name(disease_name)
    is_healthy = "healthy" in disease_name.lower()
    plant_name = disease_name.split("___")[0].replace("_", " ").replace(",", ", ")

    # Get structured knowledge for this specific disease
    # Try original key first, then normalized key
    kb_entry = _DISEASE_KB.get(disease_name) or _DISEASE_KB.get(_normalize_key(disease_name), {})
    if kb_entry:
        print(f"[LLM] KB match found for: {disease_name}")
    else:
        print(f"[LLM] WARNING: No KB match for: {disease_name} (normalized: {_normalize_key(disease_name)})")

    # Build expert resources from KB (used regardless of LLM success)
    expert_resources = _build_expert_resources(display_name, kb_entry)

    # If LLM is not loaded, return a KB-only result (no crash)
    if llm is None:
        print("[LLM] Gemma model not loaded — returning KB-only result")
        return {
            "isPlant": True,
            "plantName": plant_name,
            "confidence": confidence,
            "alternatives": [],
            "diagnosis": _build_kb_diagnosis(display_name, plant_name, kb_entry, is_healthy, confidence),
            "issues": _default_issues(is_healthy),
            "treatmentPlan": _build_kb_treatment_plan(kb_entry, is_healthy),
            "preventionTips": kb_entry.get('prevention', [
                "Regularly inspect plants for early signs of disease",
                "Maintain proper spacing for air circulation",
                "Water at the base of plants, avoiding leaf wetness"
            ]) if kb_entry else [
                "Regularly inspect plants for early signs of disease",
                "Maintain proper spacing for air circulation",
                "Water at the base of plants, avoiding leaf wetness"
            ],
            "expertResources": expert_resources,
        }

    kb_context = ""
    if kb_entry:
        kb_context = f"""
KNOWLEDGE BASE FOR THIS DISEASE:
- Severity: {kb_entry.get('severity', 'Unknown')}
- Key Symptoms: {', '.join(kb_entry.get('symptoms', [])[:3])}
- Main Causes: {', '.join(kb_entry.get('causes', [])[:3])}
- Recommended Treatment: {', '.join(kb_entry.get('treatment', [])[:3])}
- Prevention: {', '.join(kb_entry.get('prevention', [])[:3])}
"""

    prompt = f"""You are UZHAVAN AI, an expert plant pathologist.

MobileNetV3 classified this plant as: "{display_name}"
Confidence: {confidence:.1f}%
Crop: {plant_name}
{kb_context}

Provide a JSON response with this EXACT structure:
{{
  "diagnosis": "Write 2 to 3 sentences describing what disease was found, how serious it is, and what the farmer should do first.",
  "issues": {{
    "diseases": {{"detected": true, "details": "explanation of what disease was found"}},
    "pests": {{"detected": false, "details": "pest assessment"}},
    "underwatering": {{"detected": false, "details": "watering assessment"}},
    "overwatering": {{"detected": false, "details": "watering assessment"}},
    "soil": {{"detected": false, "details": "soil health observation"}},
    "sunlight": {{"detected": false, "details": "sunlight assessment"}},
    "nutrientDeficiency": {{"detected": false, "details": "nutrient assessment"}},
    "generalStress": {{"detected": {"true" if not is_healthy else "false"}, "details": "overall plant stress level"}}
  }},
  "treatmentPlan": [
    {{"title": "Immediate Treatment", "instruction": "Apply the correct fungicide or bactericide with specific product name and dosage."}},
    {{"title": "Follow-up Treatment", "instruction": "Describe the next step in treatment after the immediate action."}},
    {{"title": "Monitoring", "instruction": "Describe what to watch for over the next 7-14 days."}}
  ],
  "preventionTips": ["tip 1", "tip 2", "tip 3"],
  "expertResources": [{{"title": "resource name", "url": "leave empty"}}]
}}

{"The plant is healthy. Give 2-3 sentences of care advice in the diagnosis field. Mark all issues detected as false." if is_healthy else f"The plant has {display_name}. Write a real diagnosis about THIS specific disease. Do NOT copy the field description as your answer. Fill every field with actual content about {display_name}."}

Respond ONLY with valid JSON. Do not include field descriptions or placeholder text in your values. Write real content."""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1,
            max_tokens=1200
        )
        raw = response["choices"][0]["message"]["content"]
        parsed = extract_json(raw)

        return {
            "isPlant": True,
            "plantName": plant_name,
            "confidence": confidence,
            "alternatives": [],
            "diagnosis": _build_kb_diagnosis(display_name, plant_name, kb_entry, is_healthy, confidence),
            "issues": parsed.get("issues", _default_issues(is_healthy)),
            "treatmentPlan": parsed.get("treatmentPlan", _build_kb_treatment_plan(kb_entry, is_healthy)),
            "preventionTips": parsed.get("preventionTips", kb_entry.get('prevention', []) if kb_entry else []),
            "expertResources": expert_resources,
        }
    except Exception as e:
        import traceback
        print(f"[LLM ERROR] generate_disease_report failed: {e}")
        print(traceback.format_exc())
        return _fallback_result(plant_name, display_name, confidence, is_healthy, kb_entry, expert_resources)


def generate_chat_response(message: str) -> str:
    """Agriculture-only chatbot with full system knowledge."""

    # Layer 1: keyword guard
    if not is_agriculture_related(message):
        return "I am designed to assist only with agriculture and crop-related questions. Please ask me about plant diseases, crop care, farming techniques, or how to use UZHAVAN AI."

    # Layer 2: inject relevant KB context
    kb_context = ""
    msg_lower = message.lower()
    for class_id, entry in _DISEASE_KB.items():
        if entry['disease'].lower() in msg_lower or entry['crop'].lower() in msg_lower:
            if not entry['is_healthy']:
                kb_context += f"\n{entry['crop']} - {entry['disease']}: {', '.join(entry['symptoms'][:2])}"
            if len(kb_context) > 600:
                break

    prompt = f"""{SYSTEM_KNOWLEDGE}

{f"RELEVANT DISEASE DATA:{kb_context}" if kb_context else ""}

User question: {message}

Answer helpfully and accurately. Stay focused on agriculture only. Be concise (max 150 words)."""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
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


def _fallback_result(plant_name: str, display_name: str, confidence: float,
                     is_healthy: bool, kb_entry: dict = None,
                     expert_resources: list = None) -> dict:
    """Fallback result when LLM fails — still uses KB data if available."""
    if expert_resources is None:
        expert_resources = _build_expert_resources(display_name, kb_entry or {})
    return {
        "isPlant": True,
        "plantName": plant_name,
        "confidence": confidence,
        "alternatives": [],
        "diagnosis": _build_kb_diagnosis(display_name, plant_name, kb_entry or {}, is_healthy, confidence),
        "issues": _default_issues(is_healthy),
        "treatmentPlan": _build_kb_treatment_plan(kb_entry or {}, is_healthy),
        "preventionTips": (kb_entry or {}).get('prevention', [
            "Regularly inspect plants for early signs of disease",
            "Maintain proper spacing for air circulation",
            "Water at the base of plants, avoiding leaf wetness"
        ]),
        "expertResources": expert_resources,
    }

