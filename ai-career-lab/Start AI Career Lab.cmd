@echo off
setlocal
cd /d "%~dp0"
if not exist "backend\.venv\Scripts\python.exe" (
    py -3 -m venv "backend\.venv"
    if errorlevel 1 goto :failed
)
"backend\.venv\Scripts\python.exe" -c "import uvicorn,fastapi,sqlalchemy,pydantic,httpx,dotenv,tzdata" >nul 2>nul
if errorlevel 1 (
    "backend\.venv\Scripts\python.exe" -m pip install -r "backend\requirements.txt"
    if errorlevel 1 goto :failed
)
if not exist "frontend\dist\index.html" (
    pushd frontend
    call npm.cmd ci --no-audit --no-fund
    if errorlevel 1 goto :failed
    call npm.cmd run build
    if errorlevel 1 goto :failed
    popd
)
"backend\.venv\Scripts\python.exe" start_lab.py
if errorlevel 1 goto :failed
exit /b 0

:failed
echo The app could not start. See the message above and the setup steps in README.md.
pause
exit /b 1

