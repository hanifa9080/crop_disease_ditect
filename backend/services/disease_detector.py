import torch
from torchvision import models, transforms
from PIL import Image
import io
import config

print(f"Loading MobileNetV3 Best Model from: {config.MOBILENET_BEST_PATH}")

def load_model():
    try:
        # Initialize architecture
        model = models.mobilenet_v3_large()
        
        # Modify classifier for our number of classes
        in_features = model.classifier[3].in_features
        model.classifier[3] = torch.nn.Linear(in_features, config.NUM_CLASSES)
        
        # Load weights
        checkpoint = torch.load(config.MOBILENET_BEST_PATH, map_location=config.DEVICE)
        
        # Handle different checkpoint formats
        if isinstance(checkpoint, dict):
            print(f"Checkpoint keys: {checkpoint.keys()}")
            if 'model_state_dict' in checkpoint:
                state_dict = checkpoint['model_state_dict']
            else:
                state_dict = checkpoint
            
            # Load class names if present (CRITIAL for accuracy)
            if 'class_names' in checkpoint:
                print(f"Found class names in checkpoint: {checkpoint['class_names']}")
                config.CLASS_NAMES = checkpoint['class_names']
                config.NUM_CLASSES = len(config.CLASS_NAMES)
                # Re-init classifier with correct count if different
                model.classifier[3] = torch.nn.Linear(in_features, config.NUM_CLASSES)
        else:
            state_dict = checkpoint
            
        model.load_state_dict(state_dict)
        model.to(config.DEVICE)
        model.eval()
        print(f"Model loaded successfully. Device: {config.DEVICE}")
        return model
        
    except Exception as e:
        print(f"Error loading model: {e}")
        # ... fallback ...

# Load the model globally
model = load_model()

# Standard ImageNet normalization with CenterCrop
transform = transforms.Compose([
    transforms.Resize(256), # Resize shortest side to 256
    transforms.CenterCrop(224), # Crop center 224x224
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])


def predict_disease(image_bytes: bytes) -> dict:
    """
    Predict plant disease from raw image bytes.
    Returns { disease: str, confidence: float }
    """
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    img_tensor = transform(img).unsqueeze(0).to(config.DEVICE)

    with torch.no_grad():
        output = model(img_tensor)
        probabilities = torch.nn.functional.softmax(output, dim=1)
        confidence, pred_idx = torch.max(probabilities, dim=1)

    disease_name = config.CLASS_NAMES[pred_idx.item()]
    conf = round(confidence.item() * 100, 2)

    return {
        "disease": disease_name,
        "confidence": conf
    }
