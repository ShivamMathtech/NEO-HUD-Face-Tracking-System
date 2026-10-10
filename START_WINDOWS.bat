@echo off
cd /d "%~dp0"
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 server.py
) else (
  python server.py
)
if errorlevel 1 (
  echo.
  echo Install Python 3.10 or newer and enable Add Python to PATH.
  echo If the port is busy, run: python server.py --port 8766
)
pause
