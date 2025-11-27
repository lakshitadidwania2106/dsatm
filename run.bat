@echo off
echo Starting Backend...
start "Backend" cmd /k "cd backend && venv\Scripts\activate && uvicorn main:app --reload"

echo Starting Frontend...
start "Frontend" cmd /k "cd frontend && npm run dev"

echo.
echo Application started!
echo Frontend: http://localhost:5173
echo Backend: http://localhost:8000/docs
