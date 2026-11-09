@echo off
echo ===================================================
echo Starting AADES Frontend (Next.js on port 3000)...
echo ===================================================
cd /d "%~dp0\frontend"
if not exist ".next" (
    echo Building frontend for first run...
    npm run build
)
npm run start
pause
