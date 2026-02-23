"""
Crop recommendation service.
Uses the shared Gemma LLM to recommend crops based on soil/climate data.
"""

from services.llm_service import llm, extract_json


def recommend_crop(data) -> dict:
    """
    Recommend best crop based on soil and climate parameters.
    Returns: {recommended_crop, reason, care_tips[]}
    """
    prompt = f"""You are an agricultural expert. Recommend the best crop in JSON format:

{{
  "recommended_crop": "name of the best crop",
  "reason": "why this crop is suitable",
  "care_tips": ["tip1", "tip2", "tip3"]
}}

Soil and Climate Data:
N (Nitrogen): {data.N}
P (Phosphorus): {data.P}
K (Potassium): {data.K}
Temperature: {data.temperature}°C
Humidity: {data.humidity}%
pH: {data.pH}
Rainfall: {data.rainfall}mm

Respond ONLY with valid JSON, no extra text."""

    try:
        response = llm.create_chat_completion(
            messages=[{"role": "user", "content": prompt}],
            temperature=0.2,
            max_tokens=300
        )

        raw = response["choices"][0]["message"]["content"]
        return extract_json(raw)

    except Exception as e:
        print(f"Crop Recommendation Error: {e}")
        return {
            "recommended_crop": "Unable to determine",
            "reason": "The AI model could not process the request. Please try again.",
            "care_tips": ["Ensure your soil data is accurate", "Consult a local agricultural expert"]
        }
