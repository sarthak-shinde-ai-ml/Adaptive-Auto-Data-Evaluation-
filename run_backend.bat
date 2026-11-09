@echo off
echo ===================================================
echo Starting AADES Backend (FastAPI on port 8000)...
echo ===================================================
cd /d "%~dp0"
set LOKY_MAX_CPU_COUNT=2
"C:\Users\Sarthak\AppData\Local\Programs\Python\Python313\python.exe" -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
pause

