@echo off
echo ===================================================
echo Starting Adaptive Auto Data Evaluation System (AADES)
echo ===================================================
start "AADES Backend" "%~dp0run_backend.bat"
timeout /t 3 /nobreak >nul
start "AADES Frontend" "%~dp0run_frontend.bat"
echo Services launched!
echo Frontend: http://localhost:3000
echo Backend API Docs: http://127.0.0.1:8000/docs
pause

