@echo off
echo ===================================================
echo Starting AADES Frontend (Next.js on port 3000)...
echo ===================================================
cd /d "%~dp0\frontend"
npm run dev
pause

