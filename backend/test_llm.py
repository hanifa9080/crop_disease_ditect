
from llama_cpp import Llama
import os

model_path = r"models\gemma-3-1b-it-Q4_K_M.gguf"
print(f"Testing model at: {model_path}")

if not os.path.exists(model_path):
    print("Model file not found!")
    exit(1)

try:
    llm = Llama(
        model_path=model_path,
        n_ctx=1024,
        n_batch=256, # Try slightly larger batch
        verbose=True
    )
    print("Success!")
except Exception as e:
    print(f"Failed: {e}")
