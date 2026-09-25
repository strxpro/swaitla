@echo off
REM Lumo launcher (Windows). Extra args are passed through, e.g.:
REM   run.bat --source 1
cd /d "%~dp0"
REM already running? just open the browser instead of starting a second copy
powershell -NoProfile -Command "try { Invoke-WebRequest http://127.0.0.1:8000/api/state -TimeoutSec 2 -UseBasicParsing | Out-Null; exit 0 } catch { exit 1 }"
if %errorlevel%==0 (
  echo Aplikacja juz dziala - otwieram przegladarke.
  start "" http://127.0.0.1:8000
  goto :eof
)
if not exist ".venv\Scripts\python.exe" (
  echo [setup] tworze srodowisko...
  python -m venv .venv || goto :err
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt || goto :err
)
".venv\Scripts\python.exe" main.py --open %*
goto :eof
:err
echo Setup failed. See README.md
pause
