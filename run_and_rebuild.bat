@echo off
echo ============================================
echo   PVPIT - Rebuild Index + Start Server
echo ============================================
cd /d "%~dp0"

echo.
echo [1/2] Rebuilding FAISS index...
python rebuild_index.py
if errorlevel 1 (
    echo ERROR: Index rebuild failed. Check Python and dependencies.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Flask server...
python backend\app.py
pause
