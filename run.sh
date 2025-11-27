#!/bin/bash

# Function to kill processes on exit
cleanup() {
    echo "Stopping servers..."
    kill $BACKEND_PID
    kill $FRONTEND_PID
    exit
}

# Trap SIGINT (Ctrl+C)
trap cleanup SIGINT

echo "Starting Backend..."
cd backend
# Check if venv exists, if not create it (optional convenience)
if [ ! -d "venv" ]; then
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
else
    source venv/bin/activate
fi

uvicorn main:app --reload &
BACKEND_PID=$!
cd ..

echo "Starting Frontend..."
cd frontend
npm run dev &
FRONTEND_PID=$!
cd ..

echo ""
echo "Application started!"
echo "Frontend: http://localhost:5173"
echo "Backend: http://localhost:8000/docs"
echo "Press Ctrl+C to stop."

wait
