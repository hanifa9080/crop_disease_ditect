🔒 LAYER 1 — STRICT AGRICULTURE GUARD (Must Add)

Before calling Gemma:

AGRI_KEYWORDS = [
    "crop","plant","leaf","soil","water","fertilizer",
    "pest","disease","irrigation","harvest",
    "rice","wheat","tomato","corn","chilli",
    "farmer","yield"
]

def is_agriculture_related(text):
    text = text.lower()
    return any(word in text for word in AGRI_KEYWORDS)


Then in chat:

if not is_agriculture_related(message):
    return {
        "reply": "I am designed to assist only with agriculture and crop-related questions."
    }


Now it will NEVER respond to random nonsense.

🔒 LAYER 2 — Improve System Prompt

Update your system prompt to:

You are UZHAVAN AI.

You ONLY answer agriculture-related questions.

If the user asks unrelated questions, politely say:
"I am designed to help only with farming and crop-related topics."

If user writes in Tanglish (Tamil written in English),
interpret carefully and respond clearly in simple English.

Do NOT translate unless it relates to agriculture.
Do NOT hallucinate.
Do NOT guess.


This reduces weird outputs.

🔒 LAYER 3 — Lower Temperature

For chatbot:

temperature=0.2