# How to Run UZHAVAN AI Locally

If you are having trouble running the project in VS Code, follow these steps exactly.

## 1. Prerequisites (Check First!)
Make sure you have these installed:
-   **Python 3.9+**: Open terminal and type `python --version`. If error, install Python.
-   **Node.js**: Type `node --version`. If error, install Node.js.

## 2. Setup (Do this once)

### Backend (Python Terminal)
1.  Open VS Code.
2.  Open a **New Terminal** (`Ctrl + ~`).
3.  Go to the backend folder:
    ```powershell
    cd backend
    ```
4.  Create a virtual environment (optional but recommended):
    ```powershell
    python -m venv venv
    .\venv\Scripts\activate
    ```
5.  Install dependencies:
    ```powershell
    pip install -r requirements.txt
    ```
    *(If `requirements.txt` is missing, run: `pip install fastapi uvicorn torch torchvision pillow llama-cpp-python`)*

### Frontend (Node Terminal)
1.  Open a **Second Terminal** (Click the `+` icon in terminal panel).
2.  Go to the project root (if not already there):
    ```powershell
    cd ..
    # (Ensure you are in GEMIHACK-main folder where package.json is)
    ```
3.  Install dependencies:
    ```powershell
    npm install
    ```

## 3. Running the Project (Every time)

You need **TWO** terminals running at the same time.

### Terminal 1: Start Backend
```powershell
cd backend
# Activate venv if you made one: .\venv\Scripts\activate
python main.py
```
*Wait until you see: `Uvicorn running on http://0.0.0.0:8000`*

### Terminal 2: Start Frontend
```powershell
# In the main folder
npm run dev
```
*Wait until you see: `Local: http://localhost:3000`*

## 4. Access the App
Open your browser and go to:
**[http://localhost:3000](http://localhost:3000)**

## Common Issues
-   **"Module not found"**: You forgot `pip install` or `npm install`.
-   **"Address already in use"**: Another terminal is already running it. Close all terminals (Trash icon) and start fresh.
-   **Backend crashes immediately**: Check if you have the model files in `backend/models/`.
