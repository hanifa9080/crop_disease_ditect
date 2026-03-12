"""
Crop recommendation service.

Architecture (Hybrid — accurate + natural language):
  Step 1: Math scores all 23 crops against farmer's actual values
          → picks the best matching crop accurately every time
  Step 2: LLM writes the reason and care tips in natural farmer-friendly language
          → uses the ALREADY-SELECTED crop name + farmer's actual numbers
          → LLM cannot change the crop or hallucinate wrong values

Why hybrid:
  Pure LLM (1B model): hallucinated values, always defaulted to corn or rice
  Pure math: accurate selection but generic robotic text
  Hybrid: math accuracy + LLM natural language = best of both
"""

from services.llm_service import llm, extract_json


# 23-crop agronomic ranges
# Each entry: N(kg/ha), P(kg/ha), K(kg/ha), Temp(°C), pH, Rainfall(mm), Humidity(%)
_CROPS = {
    "Rice":          dict(N=(60,120),  P=(30,60),  K=(30,60),   T=(20,35), pH=(5.5,7.0), R=(150,300), H=(70,90)),
    "Wheat":         dict(N=(80,120),  P=(40,60),  K=(40,60),   T=(10,24), pH=(6.0,7.5), R=(50,100),  H=(40,70)),
    "Maize":         dict(N=(80,120),  P=(40,70),  K=(40,70),   T=(18,27), pH=(5.8,7.0), R=(60,110),  H=(50,80)),
    "Chickpea":      dict(N=(20,40),   P=(40,80),  K=(20,40),   T=(15,25), pH=(6.0,8.0), R=(40,100),  H=(30,60)),
    "Pigeonpea":     dict(N=(20,40),   P=(40,80),  K=(20,40),   T=(18,30), pH=(5.5,7.5), R=(60,150),  H=(50,75)),
    "Lentil":        dict(N=(20,40),   P=(30,60),  K=(20,40),   T=(15,25), pH=(6.0,8.0), R=(30,80),   H=(30,60)),
    "Groundnut":     dict(N=(20,40),   P=(40,80),  K=(30,60),   T=(22,30), pH=(5.5,7.0), R=(50,130),  H=(50,75)),
    "Cotton":        dict(N=(80,160),  P=(40,80),  K=(40,80),   T=(22,35), pH=(6.0,8.0), R=(60,120),  H=(50,80)),
    "Sugarcane":     dict(N=(100,200), P=(50,100), K=(100,200), T=(22,35), pH=(6.0,7.5), R=(150,250), H=(70,90)),
    "Mango":         dict(N=(50,100),  P=(30,60),  K=(50,100),  T=(24,35), pH=(5.5,7.5), R=(50,150),  H=(40,70)),
    "Banana":        dict(N=(100,200), P=(50,100), K=(150,300), T=(22,35), pH=(5.5,7.0), R=(100,200), H=(70,90)),
    "Orange":        dict(N=(30,80),   P=(30,60),  K=(30,80),   T=(15,30), pH=(5.5,7.5), R=(75,150),  H=(50,75)),
    "Coconut":       dict(N=(50,100),  P=(30,60),  K=(100,200), T=(24,35), pH=(5.5,8.0), R=(150,250), H=(70,90)),
    "Tomato":        dict(N=(50,100),  P=(40,80),  K=(40,80),   T=(20,30), pH=(6.0,7.0), R=(40,100),  H=(60,80)),
    "Potato":        dict(N=(60,120),  P=(50,100), K=(80,150),  T=(10,25), pH=(5.0,6.5), R=(50,100),  H=(60,80)),
    "Onion":         dict(N=(60,100),  P=(40,80),  K=(40,80),   T=(13,28), pH=(5.8,7.0), R=(35,75),   H=(50,70)),
    "Watermelon":    dict(N=(50,100),  P=(40,80),  K=(50,100),  T=(22,35), pH=(6.0,7.5), R=(40,100),  H=(50,75)),
    "Grapes":        dict(N=(30,60),   P=(20,40),  K=(30,60),   T=(15,35), pH=(5.5,7.5), R=(50,100),  H=(40,70)),
    "Coffee":        dict(N=(50,100),  P=(30,60),  K=(50,100),  T=(15,28), pH=(4.5,6.5), R=(150,250), H=(70,90)),
    "Tea":           dict(N=(60,120),  P=(30,60),  K=(60,120),  T=(13,28), pH=(4.5,6.0), R=(150,300), H=(70,90)),
    "Soybean":       dict(N=(20,60),   P=(40,80),  K=(20,60),   T=(18,30), pH=(6.0,7.5), R=(60,150),  H=(60,80)),
    "Millet":        dict(N=(40,80),   P=(20,40),  K=(20,40),   T=(25,35), pH=(5.5,7.5), R=(40,80),   H=(30,60)),
    "Sorghum":       dict(N=(60,100),  P=(30,60),  K=(30,60),   T=(25,35), pH=(5.5,7.5), R=(40,80),   H=(30,60)),
}


def _range_score(value: float, lo: float, hi: float) -> float:
    """
    Scores how well a value fits a range.
    - Inside range: 1.0 to 1.1 (1.1 at midpoint, 1.0 at edges)
      This breaks ties by preferring crops where the value is most optimal.
    - Outside range: decreases proportionally toward 0.
    """
    if lo <= value <= hi:
        mid = (lo + hi) / 2
        dist_from_mid = abs(value - mid) / max((hi - lo) / 2, 0.001)
        return 1.0 + 0.1 * (1.0 - dist_from_mid)
    elif value < lo:
        return max(0.0, 1.0 - (lo - value) / max(lo, 1))
    else:
        return max(0.0, 1.0 - (value - hi) / max(hi, 1))


def _select_crop(data) -> tuple[str, dict]:
    """
    Pure math crop selection — scores all 23 crops against farmer's values.
    Temperature and pH are weighted 2x (most critical factors).
    Rainfall weighted 1.5x.
    Returns (best_crop_name, its_ranges_dict).
    """
    scores = {}
    for crop, r in _CROPS.items():
        score = (
            _range_score(data.N,           r["N"][0],  r["N"][1])
          + _range_score(data.P,           r["P"][0],  r["P"][1])
          + _range_score(data.K,           r["K"][0],  r["K"][1])
          + _range_score(data.temperature, r["T"][0],  r["T"][1])  * 2.0
          + _range_score(data.pH,          r["pH"][0], r["pH"][1]) * 2.0
          + _range_score(data.rainfall,    r["R"][0],  r["R"][1])  * 1.5
          + _range_score(data.humidity,    r["H"][0],  r["H"][1])
        )
        scores[crop] = score

    best = max(scores, key=scores.get)
    return best, _CROPS[best]


def recommend_crop(data) -> dict:
    """
    Step 1: Math selects the best crop accurately.
    Step 2: LLM writes a natural explanation using the selected crop + actual values.
    """
    # Step 1 — accurate crop selection via scoring
    best_crop, ranges = _select_crop(data)

    print(f"[CropService] Math selected: {best_crop} for N={data.N}, P={data.P}, K={data.K}, "
          f"T={data.temperature}, H={data.humidity}, pH={data.pH}, R={data.rainfall}")

    # Step 2 — LLM writes natural explanation (cannot change the crop)
    if llm is not None:
        prompt = f"""You are an agricultural expert explaining a crop recommendation to an Indian farmer.

The AI system has already selected "{best_crop}" as the best crop for this farmer.

FARMER'S ACTUAL SOIL AND CLIMATE VALUES:
- Nitrogen (N): {data.N} kg/ha  (ideal for {best_crop}: {ranges['N'][0]}-{ranges['N'][1]} kg/ha)
- Phosphorus (P): {data.P} kg/ha  (ideal: {ranges['P'][0]}-{ranges['P'][1]} kg/ha)
- Potassium (K): {data.K} kg/ha  (ideal: {ranges['K'][0]}-{ranges['K'][1]} kg/ha)
- Temperature: {data.temperature}°C  (ideal: {ranges['T'][0]}-{ranges['T'][1]}°C)
- Humidity: {data.humidity}%  (ideal: {ranges['H'][0]}-{ranges['H'][1]}%)
- Soil pH: {data.pH}  (ideal: {ranges['pH'][0]}-{ranges['pH'][1]})
- Rainfall: {data.rainfall} mm  (ideal: {ranges['R'][0]}-{ranges['R'][1]} mm)

YOUR TASK:
Write a clear explanation for the farmer of WHY {best_crop} is recommended.
- Mention 3-4 of the farmer's actual values by name and number
- Explain how those values match {best_crop}'s requirements
- Write in simple English, like talking to a farmer face to face
- 3 sentences minimum

Also write 3 specific practical care tips for growing {best_crop}.

Return ONLY valid JSON:
{{
  "reason": "3-4 sentences mentioning the farmer's actual values and why they suit {best_crop}",
  "care_tips": [
    "Specific care tip 1 for {best_crop}",
    "Specific care tip 2 for {best_crop}",
    "Specific care tip 3 for {best_crop}"
  ]
}}"""

        try:
            response = llm.create_chat_completion(
                messages=[{"role": "user", "content": prompt}],
                temperature=0.1,
                max_tokens=350
            )
            raw = response["choices"][0]["message"]["content"]
            llm_result = extract_json(raw)

            return {
                "recommended_crop": best_crop,
                "reason":    llm_result.get("reason", _default_reason(best_crop, data, ranges)),
                "care_tips": llm_result.get("care_tips", _default_tips(best_crop)),
            }

        except Exception as e:
            print(f"[CropService] LLM explanation failed (non-fatal): {e}")

    # Fallback: math-selected crop + pre-written reason
    return {
        "recommended_crop": best_crop,
        "reason":    _default_reason(best_crop, data, ranges),
        "care_tips": _default_tips(best_crop),
    }


def _default_reason(crop: str, data, ranges: dict) -> str:
    """Pre-written reason using actual farmer values — used when LLM fails."""
    return (
        f"Based on your soil and climate data, {crop} is the best match. "
        f"Your temperature ({data.temperature}°C) is within the ideal range of "
        f"{ranges['T'][0]}-{ranges['T'][1]}°C, your rainfall ({data.rainfall}mm) fits the "
        f"{ranges['R'][0]}-{ranges['R'][1]}mm requirement, and your soil pH ({data.pH}) "
        f"is suitable for {crop} cultivation."
    )


def _default_tips(crop: str) -> list:
    """Fallback care tips per crop."""
    tips = {
        "Rice":       ["Keep fields flooded to 5cm during vegetative stage", "Apply nitrogen in 3 split doses", "Drain field 2 weeks before harvest"],
        "Wheat":      ["Sow 5-6cm deep in well-prepared soil", "Apply first irrigation at crown root initiation", "Control weeds in first 30-40 days"],
        "Maize":      ["Sow 3-4cm deep at 75x25cm spacing", "Apply nitrogen top dressing at knee-high stage", "Harvest when husks turn brown and dry"],
        "Chickpea":   ["Use rhizobium seed treatment before sowing", "Avoid waterlogging — needs well-drained soil", "Spray fungicide if grey mold appears"],
        "Pigeonpea":  ["Sow at 60x20cm spacing", "Intercrop with soybean to maximise income", "Harvest when 80% of pods turn brown"],
        "Lentil":     ["Sow in well-drained soil after rain", "No heavy nitrogen needed — fixes its own", "Harvest when lower pods turn yellow-brown"],
        "Groundnut":  ["Sow seeds with shell removed, 5cm deep", "Apply gypsum at flowering for good pod filling", "Harvest carefully to avoid underground pod loss"],
        "Cotton":     ["Use certified Bt cotton seed", "Irrigate at flowering and boll formation", "Scout for bollworm and spray only when needed"],
        "Sugarcane":  ["Plant setts with 2-3 buds at 75cm row spacing", "Apply heavy potassium at 3 and 6 months", "Remove dry leaves to improve air circulation"],
        "Mango":      ["Plant 10x10m apart", "Prune after harvest to encourage new flowering", "Apply potassium before flowering for better fruit set"],
        "Banana":     ["Plant suckers at 1.8x1.8m spacing", "Apply potassium-rich fertiliser every month", "Prop plants with bamboo supports when flowering"],
        "Orange":     ["Plant in well-drained soil with full sunlight", "Irrigate regularly but avoid waterlogging", "Apply micronutrient spray twice a year"],
        "Coconut":    ["Plant in 1x1x1m pits filled with compost", "Apply potassium and micronutrients yearly", "Water young palms daily for first 2 years"],
        "Tomato":     ["Stake plants at 30cm height", "Water regularly — avoid dry spells during fruiting", "Spray copper fungicide to prevent bacterial diseases"],
        "Potato":     ["Plant certified seed tubers only", "Hill up soil when plants are 20cm tall", "Stop watering 2 weeks before harvest"],
        "Onion":      ["Plant sets 10cm apart in rows 30cm apart", "Reduce watering as bulbs mature", "Cure harvested onions in shade for 2 weeks"],
        "Watermelon": ["Sow on raised beds with drip irrigation", "Apply potassium at fruit set for sweetness", "Harvest when tendril nearest fruit turns brown"],
        "Grapes":     ["Train vines on a trellis from year one", "Prune back to 2-3 buds after each harvest", "Apply copper spray before flowering"],
        "Coffee":     ["Plant in partial shade with rich organic soil", "Keep soil moist but never waterlogged", "Apply balanced fertiliser three times a year"],
        "Tea":        ["Plant in acidic well-drained soil on slopes", "Prune bushes regularly to encourage new shoots", "Harvest only the top two leaves and bud"],
        "Soybean":    ["Treat seed with rhizobium before sowing", "Avoid waterlogging", "Harvest at 13-15% moisture"],
        "Millet":     ["Sow after first good rain", "Thin to one plant per hill after 2 weeks", "No irrigation needed if rainfall above 40mm"],
        "Sorghum":    ["Sow at 45x15cm spacing after first rains", "Apply nitrogen top dressing at 30 days", "Harvest when grains are hard and dry"],
    }
    return tips.get(crop, [
        "Follow standard agronomic practices for this crop",
        "Monitor for pests and diseases regularly",
        "Consult your local agricultural extension officer"
    ])
