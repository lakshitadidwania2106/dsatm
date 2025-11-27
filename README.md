# React + Vite + FastAPI Boilerplate

This is a simple boilerplate for a React frontend and a FastAPI backend.

## Structure

- `frontend/`: React application created with Vite.
- `backend/`: FastAPI application.

## Prerequisites

- Node.js
- Python 3.8+

## Setup

1.  **Frontend**:
    ```bash
    cd frontend
    npm install
    ```

2.  **Backend**:
    ```bash
    cd backend
    python -m venv venv
    venv\Scripts\activate
    pip install -r requirements.txt
    ```

## Running

### Windows
Double-click `run.bat` or run it from the terminal:

```bash
.\run.bat
```

### Mac/Linux
Make the script executable (first time only) and run it:

```bash
chmod +x run.sh
./run.sh
```

This will start:
- Backend at http://localhost:8000
- Frontend at http://localhost:5173

The frontend is configured to proxy `/api` requests to the backend.
