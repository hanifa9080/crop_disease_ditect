"""
llm_service.py — Gemma 3 1B LLM service via llama-cpp-python.

Architecture (v3 — Farmer Simplification):
  ┌─────────────────────────────────────────────────────────────┐
  │  MobileNetV3 → disease_name + confidence                    │
  │       ↓                                                     │
  │  PASS 1 — Report Generation                                 │
  │    KB  → issue_factors (detected + details, exact)          │
  │    KB  → expert_resources (real URLs, guaranteed 3)         │
  │    LLM → diagnosis, treatmentPlan, preventionTips           │
  │       ↓                                                     │
  │  PASS 2 — Farmer Simplification                             │
  │    LLM → rewrites ALL text into plain, simple English       │
  │           that any farmer can understand                    │
  └─────────────────────────────────────────────────────────────┘

Why two passes:
  Pass 1 makes the report ACCURATE.
  Pass 2 makes it ACCESSIBLE — rewrites for a farmer with no
  technical education. Scientific Latin names become plain
  descriptions. Dense paragraphs become short direct sentences.
  If Pass 2 fails, Pass 1 output is returned unchanged (non-fatal).

Token budget (Gemma 3 1B, N_CTX=2048):
  Pass 1: ~600 tokens  (prompt + output)
  Pass 2: ~635 tokens  (all text fields combined)
  Total:  ~1235 tokens — safe within 2048
"""

import json
import re
import traceback
from pathlib import Path

import config

# ── Load Disease Knowledge Base ───────────────────────────────────────────────

_KB_PATH = Path(__file__).parent.parent / "data" / "disease_knowledge.json"
_DISEASE_KB: dict = {}

try:
    with open(_KB_PATH, "r", encoding="utf-8") as f:
        raw = json.load(f)
    for entry in raw.get("diseases", []):
        _DISEASE_KB[entry["class_id"]] = entry
    print(f"[LLM] Disease KB loaded: {len(_DISEASE_KB)} entries")
except Exception as e:
    print(f"[LLM] WARNING: Could not load disease KB: {e}")


# ── Load Gemma LLM ─────────────────────────────────────────────────────────────

print(f"Loading Gemma LLM from: {config.GEMMA_PATH}")
llm = None
try:
    import os
    model_path = str(config.GEMMA_PATH)
    if os.path.exists(model_path):
        print(f"  Model file found. Size: {os.path.getsize(model_path) / (1024**2):.1f} MB")
    else:
        print(f"  WARNING: Model file not found at {model_path}")

    from llama_cpp import Llama
    # NOTE: Do NOT pass chat_format="gemma" — it crashes llama-cpp-python v0.3.x.
    # The Gemma 3 GGUF model auto-detects its chat template from metadata.
    llm = Llama(
        model_path=model_path,
        n_ctx=config.N_CTX,
        n_threads=getattr(config, "N_THREADS", 6),
        n_batch=getattr(config, "N_BATCH", 512),
        verbose=False,
    )
    print("  Gemma LLM loaded successfully.")
except Exception as e:
    print(f"  WARNING: Failed to load Gemma LLM: {e}")
    llm = None


def reload_llm():
    """Manually attempt to reload the LLM if it failed at startup."""
    global llm
    if llm is not None:
        return True
    print(f"[LLM] Manual reload triggered. Looking for: {config.GEMMA_PATH}")
    import os as _os
    model_path = str(config.GEMMA_PATH)
    if not _os.path.isfile(model_path):
        print(f"WARNING: Gemma model file does NOT exist at: {model_path}")
        return False
    try:
        from llama_cpp import Llama
        llm = Llama(
            model_path=model_path,
            n_ctx=config.N_CTX,
            n_batch=getattr(config, "N_BATCH", 512),
            n_threads=getattr(config, "N_THREADS", 6),
            verbose=False,
        )
        print("  Gemma LLM reloaded successfully.")
        return True
    except Exception as e:
        print(f"  ERROR reloading Gemma LLM: {e}")
        return False

if llm is None:
    print("WARNING: Gemma LLM is not available. Disease reports will use KB-only mode.")


# ── Helpers ───────────────────────────────────────────────────────────────────

def _format_disease_name(raw: str) -> str:
    """'Tomato___Late_blight' -> 'Tomato - Late Blight'"""
    return raw.replace("___", " - ").replace("_", " ").title()


def _extract_disease_part(disease_name: str) -> str:
    """
    Extract only the disease portion from the MobileNetV3 class ID.

    Examples:
      'Tomato___Late_blight'                         → 'Late Blight'
      'Pepper,_bell___Bacterial_spot'                → 'Bacterial Spot'
      'Corn___Cercospora_leaf_spot Gray_leaf_spot'   → 'Cercospora Leaf Spot Gray Leaf Spot'
      'Tomato___healthy'                             → 'Healthy'
      'Apple___Apple_scab'                           → 'Apple Scab'
    """
    if "___" in disease_name:
        disease_part = disease_name.split("___", 1)[1]
        return disease_part.replace("_", " ").replace(",", ", ").title()
    # No separator found — return whole string cleaned up
    return disease_name.replace("_", " ").title()


def _extract_json(text: str) -> dict:
    """Strip markdown fences and extract first JSON object found."""
    text = re.sub(r"```json|```", "", text).strip()
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        return json.loads(match.group(0))
    raise ValueError(f"No JSON object found in LLM output: {text[:300]}")

# Public alias — needed by crop_service.py
extract_json = _extract_json


def _build_expert_resources(kb_entry: dict, display_name: str, plant_name: str) -> list:
    """KB real URLs first, Google Search fallback to guarantee 3."""
    resources = []
    for r in kb_entry.get("expert_resources", []):
        if r.get("url", "").startswith("http"):
            resources.append({
                "title":       r["title"],
                "description": r.get("description", f"Expert guidance on {display_name}."),
                "url":         r["url"],
            })
    fallbacks = [
        {
            "title":       f"{display_name} - Treatment and Management Guide",
            "description": f"Find the best treatment and management steps for {display_name}.",
            "url":         f"https://www.google.com/search?q={display_name.replace(' ', '+')}+treatment+management+guide",
        },
        {
            "title":       f"{plant_name} Disease Control - University Extension",
            "description": f"University agricultural extension advice for {plant_name} disease control.",
            "url":         f"https://www.google.com/search?q={plant_name.replace(' ', '+')}+disease+control+extension+university",
        },
        {
            "title":       f"{display_name} - Fungicide and Pesticide Guide",
            "description": f"Which medicine to use and how to apply it for {display_name}.",
            "url":         f"https://www.google.com/search?q={display_name.replace(' ', '+')}+fungicide+pesticide+control",
        },
    ]
    i = 0
    while len(resources) < 3 and i < len(fallbacks):
        resources.append(fallbacks[i])
        i += 1
    return resources


def _kb_diagnosis_fallback(display_name, plant_name, kb_entry, is_healthy, confidence):
    """Build a factual diagnosis string from KB data — used when LLM fails."""
    if is_healthy:
        return (
            f"Your {plant_name} looks healthy. The AI checked it with "
            f"{confidence:.1f}% confidence and found no disease. Keep caring for it well."
        )
    parts = [f"Your {plant_name} has {display_name} ({confidence:.1f}% confidence)."]
    causes = kb_entry.get("causes", [])
    if causes:
        parts.append(f"It is caused by {causes[0]}.")
    symptoms = kb_entry.get("symptoms", [])
    if symptoms:
        parts.append(symptoms[0] + ".")
    if not causes and not symptoms:
        parts.append("Please contact your local agricultural officer for treatment advice.")
    return " ".join(parts)


def _default_issues(is_healthy: bool) -> dict:
    """Return default issues structure with simple farmer-friendly text."""
    base = {
        "diseases":           {"detected": False, "details": "No signs of disease found on this plant."},
        "pests":              {"detected": False, "details": "No insect or pest damage spotted."},
        "underwatering":      {"detected": False, "details": "The plant looks well watered."},
        "overwatering":       {"detected": False, "details": "No signs of too much water."},
        "soil":               {"detected": False, "details": "Soil conditions look fine."},
        "sunlight":           {"detected": False, "details": "The plant is getting enough light."},
        "nutrientDeficiency": {"detected": False, "details": "No signs of nutrient shortage."},
        "generalStress":      {"detected": False, "details": "The plant looks healthy and strong."},
    }
    if not is_healthy:
        base["diseases"]["detected"] = True
        base["diseases"]["details"] = "The AI detected signs of disease on this plant."
    return base


# ── PASS 2: Farmer Simplification ─────────────────────────────────────────────

def _simplify_for_farmer(report: dict, display_name: str, plant_name: str) -> dict:
    """
    Second Gemma pass. Rewrites every text field in the report into
    plain, simple English for a farmer with no technical education.

    What gets simplified:
      diagnosis, treatmentPlan[].instruction, preventionTips[],
      issues[key].details (all 8 health check cards),
      expertResources[].description

    What is NOT changed:
      plantName, confidence, alternatives (data values)
      issues[key].detected (boolean — not text)
      expertResources[].title, .url (kept for searchability)
      treatmentPlan[].title (short labels — already plain)

    Non-fatal: if this call fails, original report is returned unchanged.
    Token budget: ~635 / 2048 — well within limit.
    """
    if llm is None:
        return report

    # Collect only the text fields to simplify
    issues_text = {k: v.get("details", "") for k, v in report.get("issues", {}).items()}

    to_simplify = {
        "diagnosis":            report.get("diagnosis", ""),
        "treatmentSteps":       [s.get("instruction", "") for s in report.get("treatmentPlan", [])],
        "preventionTips":       report.get("preventionTips", []),
        "healthCheckDetails":   issues_text,
        "resourceDescriptions": [r.get("description", "") for r in report.get("expertResources", [])],
    }

    prompt = f"""You are a farming advisor.
Rewrite the crop disease report text below to be detailed, clear, and educational.

The reader is a farmer. Write like you are a helpful expert giving them a thorough consultation.

Rules:
1. Provide detailed, thorough explanations so the farmer fully understands the 'why' behind the disease, the causes, and the treatments. DO NOT make it too short.
2. Replace ALL scientific Latin names with plain words:
   - "oomycete Phytophthora infestans" -> "a water mold germ"
   - "Alternaria solani" -> "an Early Blight fungus germ"
   - "Xanthomonas vesicatoria" -> "a bacteria germ"
   - "Tetranychus urticae" -> "tiny spider mites"
   - "Candidatus Liberibacter" -> "a deadly bacteria spread by insects"
   - Any other Latin name -> "a [type] germ that causes [disease name]"
3. Replace technical words:
   - "inoculum" -> "disease germs"
   - "sporulation" -> "spreading"
   - "lesion" -> "spot or damage"
   - "defoliation" -> "leaf drop"
   - "systemic insecticide" -> "insect medicine"
   - "bactericide" -> "bacteria spray"
   - "oomycete" -> "water mold"
   - "pathogen" -> "germ"
4. KEEP these as-is: product names like Metalaxyl, Mancozeb, Captan, Azoxystrobin
5. Expand and add helpful context to the information so it is highly informative.
6. Start action sentences with verbs: "Spray...", "Remove...", "Water...", "Check..."
7. Be warm, professional, and highly educational.

Input JSON:
{json.dumps(to_simplify, ensure_ascii=False)}

Return ONLY a valid JSON object. It must have the EXACT same structure and keys as the Input JSON above. Replace all the original text values with your newly detailed, enhanced, and educational text. Do not include markdown code blocks.
"""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=1000,
        )
        raw = response["choices"][0]["message"]["content"]
        simplified = _extract_json(raw)

        # Merge simplified text back into report — non-destructive merge
        if simplified.get("diagnosis"):
            report["diagnosis"] = simplified["diagnosis"]

        steps = simplified.get("treatmentSteps", [])
        for i, step in enumerate(report.get("treatmentPlan", [])):
            if i < len(steps) and steps[i]:
                step["instruction"] = steps[i]

        if simplified.get("preventionTips"):
            report["preventionTips"] = simplified["preventionTips"]

        hc = simplified.get("healthCheckDetails", {})
        for key, val in report.get("issues", {}).items():
            if hc.get(key):
                val["details"] = hc[key]

        descs = simplified.get("resourceDescriptions", [])
        for i, res in enumerate(report.get("expertResources", [])):
            if i < len(descs) and descs[i]:
                res["description"] = descs[i]

        print("[LLM] Pass 2 simplification: OK")
        return report

    except Exception as e:
        print(f"[LLM] Pass 2 simplification failed (non-fatal): {e}")
        print("[LLM] Returning Pass 1 report unchanged.")
        return report


# ── PASS 1: Report Generation ─────────────────────────────────────────────────

def generate_disease_report(disease_name: str, confidence: float) -> dict:
    """
    Full pipeline: KB + Gemma Pass 1 (accurate) + Gemma Pass 2 (simple).

    Pass 1: KB drives issue_factors and real URLs, Gemma writes narrative
    Pass 2: Gemma rewrites all text into plain farmer-friendly English
    """
    display_name = _format_disease_name(disease_name)
    is_healthy = "healthy" in disease_name.lower()

    # Extract plant name (e.g. "Tomato___Late_blight" → "Tomato")
    # Note: replace underscores first, then normalize ", " to avoid double spaces
    # e.g. "Pepper,_bell" → "Pepper, bell" → "Pepper, Bell"
    raw_plant = disease_name.split("___")[0].replace("_", " ")
    plant_name = raw_plant.replace(",", ", ").replace("  ", " ").title()

    # Extract disease name separately (e.g. "Tomato___Late_blight" → "Late Blight")
    disease_part = _extract_disease_part(disease_name)

    # KB lookup
    kb_entry = _DISEASE_KB.get(disease_name, {})
    if kb_entry:
        print(f"[LLM] KB match: {disease_name}")
    else:
        print(f"[LLM] No KB entry for: {disease_name}")

    issues          = kb_entry.get("issue_factors") or _default_issues(is_healthy)
    expert_resources = _build_expert_resources(kb_entry, display_name, plant_name)

    # KB context for Gemma Pass 1
    kb_context = ""
    if kb_entry and not is_healthy:
        kb_context = f"""
Known facts about {display_name}:
- Severity: {kb_entry.get('severity', 'Medium')}
- Key symptoms: {'; '.join(kb_entry.get('symptoms', [])[:3])}
- Primary causes: {'; '.join(kb_entry.get('causes', [])[:2])}
- Core treatments: {'; '.join(kb_entry.get('treatment', [])[:3])}
- Prevention: {'; '.join(kb_entry.get('prevention', [])[:3])}"""

    # Pass 1 prompt
    if is_healthy:
        prompt = f"""You are UZHAVAN AI, a farming expert who helps farmers understand plant health.
A MobileNetV3 classifier identified a {plant_name} as healthy ({confidence:.1f}% confidence).
You have NOT seen the image. Write a helpful health report from your knowledge.

LANGUAGE RULES — follow these strictly:
- Write like you are talking to a farmer who has no science degree
- Use SHORT, SIMPLE sentences — one idea per sentence
- DO NOT use Latin scientific names
- Use everyday words a farmer understands
- Keep responses to 2-3 sentences per field

Respond ONLY with valid JSON, no other text:
{{
  "diagnosis": "2 sentences confirming {plant_name} is healthy and a simple everyday care tip",
  "treatmentPlan": [
    {{"title": "Routine Monitoring", "instruction": "Clear, simple routine care action for healthy {plant_name}"}}
  ],
  "preventionTips": [
    "Simple prevention tip 1 for {plant_name}",
    "Simple prevention tip 2",
    "Simple prevention tip 3"
  ]
}}"""
    else:
        prompt = f"""You are UZHAVAN AI, a farming expert who helps farmers understand plant diseases.
A MobileNetV3 classifier identified this plant as: "{display_name}" ({confidence:.1f}% confidence).
You have NOT seen the image. Use your knowledge and the context below.
{kb_context}

LANGUAGE RULES — follow these strictly or your answer is wrong:
- Write like you are talking to a farmer who has no science degree
- Use SHORT, SIMPLE sentences — one idea per sentence
- DO NOT use Latin scientific names — never write anything like "Xanthomonas campestris pv. vesicatoria"
  Instead just say "a harmful bacteria" or "a type of fungus"
- Use everyday words: say "spreads through water droplets" not "disseminated via splash dispersal"
- Say "dark spots appear on leaves" not "necrotic lesions with chlorotic halos"
- You CAN use the disease common name (e.g. "Bacterial Spot", "Late Blight") — just never Latin
- Never use temperature numbers like 75-86°F
- Keep each "details" field to 2-3 sentences maximum
- The diagnosis must NOT start with "Plant - Disease is..." — write naturally

RULES FOR THE 8 HEALTH CHECK FIELDS (diseases, pests, overwatering, underwatering, soil, sunlight, nutrientDeficiency, generalStress):
1. For each field, decide if it is a cause or makes the disease worse. If YES, set "detected": true. If NO, set "detected": false.
2. If "detected": true, you MUST start "details" with "[Factor] can contribute to [disease]" (or similar), and explain how.
3. If "detected": false, you MUST start "details" with "[Factor] does not cause [disease]" (or similar), and explain why.

Respond ONLY with valid JSON. Do not include markdown code blocks. Here is the strict JSON schema you must follow:
{{
  "diagnosis": "2-3 sentences. What is wrong with the plant. What it means for the farmer. Written simply.",
  "issues": {{
    "diseases": {{
      "detected": true,
      "details": "Start with '[Disease name] is present on this plant.' Describe what it looks like in plain words, and how serious it is."
    }},
    "pests": {{
      "detected": true_or_false,
      "details": "Details about pests."
    }},
    "overwatering": {{
      "detected": true_or_false,
      "details": "Details about overwatering."
    }},
    "underwatering": {{
      "detected": true_or_false,
      "details": "Details about underwatering."
    }},
    "soil": {{
      "detected": true_or_false,
      "details": "Details about soil."
    }},
    "sunlight": {{
      "detected": true_or_false,
      "details": "Details about sunlight."
    }},
    "nutrientDeficiency": {{
      "detected": true_or_false,
      "details": "Details about nutrient deficiency."
    }},
    "generalStress": {{
      "detected": true_or_false,
      "details": "Details about general stress."
    }}
  }},
  "treatmentPlan": [
    {{"title": "Short action title", "instruction": "Clear step a farmer can do today. No jargon. Practical."}}
  ],
  "preventionTips": [
    "Simple tip 1",
    "Simple tip 2"
  ]
}}"""

    # If LLM is not loaded, try one last time to reload it
    if llm is None:
        print("[LLM] llm is None, attempting on-demand reload...")
        reload_llm()

    # Call Gemma Pass 1
    raw_output = None
    try:
        if llm is None:
            raise RuntimeError("LLM not loaded")
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.15,
            max_tokens=1200,
        )
        raw_output = response["choices"][0]["message"]["content"]
        parsed = _extract_json(raw_output)

        # Merge LLM-generated issues with KB-driven issues
        # KB provides accurate detected booleans; LLM provides verdict-first wording
        llm_issues = parsed.get("issues", {})
        if llm_issues:
            for key in issues:
                if key in llm_issues and llm_issues[key].get("details"):
                    # Keep KB detected boolean (more accurate), use LLM details (better wording)
                    issues[key]["details"] = llm_issues[key]["details"]
                    # If KB didn't have this field, also use LLM detected value
                    if not kb_entry.get("issue_factors"):
                        issues[key]["detected"] = llm_issues[key].get("detected", issues[key]["detected"])

        # Build the full PlantAnalysisResult
        raw_treatment = parsed.get("treatmentPlan", [])
        normal_treatment = []
        for i, t in enumerate(raw_treatment):
            if isinstance(t, str):
                normal_treatment.append({"title": f"Step {i+1}", "instruction": t})
            else:
                normal_treatment.append(t)

        report = {
            "isPlant":         True,
            "plantName":       plant_name,
            "diseaseName":     disease_part,
            "confidence":      confidence,
            "alternatives":    [],
            "diagnosis":       parsed.get("diagnosis") or _kb_diagnosis_fallback(
                                   display_name, plant_name, kb_entry, is_healthy, confidence),
            "issues":          issues,
            "treatmentPlan":   normal_treatment,
            "preventionTips":  parsed.get("preventionTips", []),
            "expertResources": expert_resources,
        }

    except Exception as e:
        print(f"[LLM] Pass 1 error: {e}")
        if raw_output:
            print(f"[LLM] Raw snippet: {raw_output[:300]}")
        print(traceback.format_exc())
        report = _fallback_result(
            plant_name, disease_part, display_name, confidence, is_healthy,
            kb_entry, issues, expert_resources
        )

    # Pass 2: Simplify for farmer
    report = _simplify_for_farmer(report, display_name, plant_name)

    # Force KB exact details to override LLM over-simplification
    if kb_entry:
        if kb_entry.get("doctor_diagnosis"):
            report["diagnosis"] = kb_entry["doctor_diagnosis"]
            
        # Override Health Checks back to user's exact KB text
        kb_issues = kb_entry.get("issue_factors", {})
        if kb_issues:
            for k, v in kb_issues.items():
                if k in report["issues"] and "details" in v:
                    report["issues"][k]["details"] = v["details"]
                    report["issues"][k]["detected"] = v.get("detected", False)
                    
        # Override Treatment Plan back to user's exact KB text
        if kb_entry.get("treatment"):
            report["treatmentPlan"] = [
                {"title": f"Step {i+1}", "instruction": t}
                for i, t in enumerate(kb_entry["treatment"])
            ]
            
        # Override Prevention Tips back to user's exact KB text
        if kb_entry.get("prevention"):
            report["preventionTips"] = list(kb_entry["prevention"])

    return report


def _fallback_result(plant_name, disease_part, display_name, confidence, is_healthy,
                     kb_entry, issues, expert_resources) -> dict:
    """
    KB-driven fallback when Gemma Pass 1 fails.
    Uses simple farmer-friendly language. Includes diseaseName.

    Note: signature changed — added disease_part as second parameter.
    Old: _fallback_result(plant_name, display_name, confidence, ...)
    New: _fallback_result(plant_name, disease_part, display_name, confidence, ...)
    """
    treatment = []
    if kb_entry.get("treatment"):
        treatment = [{"title": f"Step {i+1}", "instruction": t}
                     for i, t in enumerate(kb_entry["treatment"])]
    elif not is_healthy:
        treatment = [
            {"title": "Remove sick leaves now",
             "instruction": "Cut off any leaves that have spots, are yellow, or look dead. "
                            "Put them in a bag and throw them away — do not leave them on the ground."},
            {"title": "Talk to your local farm advisor",
             "instruction": "Take a clear photo of the affected leaves to your nearest agricultural office. "
                            "They can confirm the disease and recommend the right spray or treatment."},
        ]
    return {
        "isPlant":        True,
        "plantName":      plant_name,
        "diseaseName":    disease_part,
        "confidence":     confidence,
        "alternatives":   [],
        "diagnosis":      _kb_diagnosis_fallback(
                               display_name, plant_name, kb_entry, is_healthy, confidence),
        "issues":          issues,
        "treatmentPlan":   treatment,
        "preventionTips":  kb_entry.get("prevention", [
            "Check your plants every 2-3 days for new spots or colour changes",
            "Water at the base of the plant — keep the leaves dry",
            "Give plants enough space so air can flow between them",
        ]),
        "expertResources": expert_resources,
    }


# ── Chat ──────────────────────────────────────────────────────────────────────

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
- Bell Pepper: Bacterial Spot, Healthy
- Potato: Early Blight, Late Blight, Healthy
- Soybean: Healthy
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
    "crop","plant","leaf","leaves","soil","water","fertilizer","pest","hi","hello","thank you",
    "disease","irrigation","harvest","rice","wheat","tomato","corn","how","where","when",
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


def generate_chat_response(message: str, history: list = None) -> str:
    """Agricultural chatbot with conversation memory — uses plain, farmer-friendly language."""

    # Layer 1: keyword guard
    if not is_agriculture_related(message):
        return "I am designed to assist only with agriculture and crop-related questions. Please ask me about plant diseases, crop care, farming techniques, or how to use UZHAVAN AI."

    if llm is None:
        return "The AI assistant is not available right now. Please try again later."

    # Layer 2: inject relevant KB context
    kb_context = ""
    msg_lower = message.lower()
    for class_id, entry in _DISEASE_KB.items():
        if entry.get('disease', '').lower() in msg_lower or entry.get('crop', '').lower() in msg_lower:
            if not entry.get('is_healthy', True):
                kb_context += f"\n{entry['crop']} - {entry['disease']}: {', '.join(entry.get('symptoms', [])[:2])}"
            if len(kb_context) > 600:
                break

    # Layer 3: build conversation history context (max last 10 turns to stay in token budget)
    history_context = ""
    if history:
        recent = history[-20:]  # last 10 turns = 20 messages (user + model)
        history_lines = []
        for h in recent:
            role_label = "Farmer" if h.get("role") == "user" else "UZHAVAN AI"
            content = h.get("content", "")[:200]  # cap each message
            history_lines.append(f"{role_label}: {content}")
        if history_lines:
            history_context = "\n\nPREVIOUS CONVERSATION:\n" + "\n".join(history_lines)

    prompt = f"""{SYSTEM_KNOWLEDGE}

{f"RELEVANT DISEASE DATA:{kb_context}" if kb_context else ""}
{history_context}

User question: {message}

You speak simply and clearly, like talking to a farmer face to face.
Use short sentences. Avoid technical jargon. Be practical and direct.
Answer helpfully and accurately. Stay focused on agriculture only.
If the farmer refers to something from the previous conversation, use that context to answer."""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=400,
        )
        return response["choices"][0]["message"]["content"].strip()
    except Exception as e:
        print(f"[LLM] Chat error: {e}")
        return "I am having trouble right now. Please try again in a moment."
