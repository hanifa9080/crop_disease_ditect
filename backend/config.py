from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent
MODEL_DIR = BASE_DIR / "models"

# MobileNetV3
MOBILENET_PATH = MODEL_DIR / "mobilenetv3_scripted.pt"
MOBILENET_BEST_PATH = MODEL_DIR / "mobilenetv3_best_model.pth"
DEVICE = "cpu"
MAX_IMAGE_SIZE_MB = 10

# Gemma LLM
GEMMA_PATH = MODEL_DIR / "gemma-3-1b-it-Q4_K_M.gguf"
N_CTX = 2048
N_THREADS = 6
N_BATCH = 512

# 27 classes from PlantVillage dataset (alphabetical order as used by ImageFolder)
CLASS_NAMES = [
    "Corn___Cercospora_leaf_spot Gray_leaf_spot",
    "Corn___Common_rust",
    "Corn___Northern_Leaf_Blight",
    "Corn___healthy",
    "Grape___Black_rot",
    "Grape___Esca_(Black_Measles)",
    "Grape___Leaf_blight_(Isariopsis_Leaf_Spot)",
    "Grape___healthy",
    "Orange___Haunglongbing_(Citrus_greening)",
    "Pepper,_bell___Bacterial_spot",
    "Pepper,_bell___healthy",
    "Potato___Early_blight",
    "Potato___Late_blight",
    "Potato___healthy",
    "Soybean___healthy",
    "Strawberry___Leaf_scorch",
    "Strawberry___healthy",
    "Tomato___Bacterial_spot",
    "Tomato___Early_blight",
    "Tomato___Late_blight",
    "Tomato___Leaf_Mold",
    "Tomato___Septoria_leaf_spot",
    "Tomato___Spider_mites Two-spotted_spider_mite",
    "Tomato___Target_Spot",
    "Tomato___Tomato_Yellow_Leaf_Curl_Virus",
    "Tomato___Tomato_mosaic_virus",
    "Tomato___healthy",
]

NUM_CLASSES = len(CLASS_NAMES)
