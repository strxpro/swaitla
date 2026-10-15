@echo off
setlocal EnableExtensions
REM ==========================================================================
REM  Lumo - instalacja na tym komputerze (Windows 10 / 11)
REM  1. szuka Pythona 3.10+ (w razie braku proponuje instalacje przez winget)
REM  2. tworzy srodowisko .venv i instaluje pakiety (z folderu wheels = bez internetu)
REM  3. tworzy skrot na pulpicie i w menu Start
REM ==========================================================================
cd /d "%~dp0"
title Lumo - instalacja
echo.
echo   ================================================
echo     Lumo  -  instalacja
echo   ================================================
echo.

REM ---------------------------------------------------------------- 1. Python
set "PY="
call :findpy
if defined PY goto :havepy
echo   [1/4] Nie znaleziono Pythona 3.10 lub nowszego.
where winget >nul 2>nul
if errorlevel 1 goto :manualpy
choice /C TN /M "        Zainstalowac Pythona 3.12 automatycznie (T = tak, N = nie)"
if errorlevel 2 goto :manualpy
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements
if exist "%LocalAppData%\Programs\Python\Python312\python.exe" set PY="%LocalAppData%\Programs\Python\Python312\python.exe"
if not defined PY call :findpy
if defined PY goto :havepy
:manualpy
echo.
echo   Zainstaluj Pythona ze strony python.org (zaznacz "Add python.exe to PATH"),
echo   potem uruchom instaluj.bat jeszcze raz.
start "" https://www.python.org/downloads/windows/
pause
exit /b 1

:havepy
echo   [1/4] Python OK:
%PY% --version

REM ---------------------------------------------------------------- 2. virtual environment
if exist ".venv\Scripts\python.exe" (
  echo   [2/4] Srodowisko .venv juz istnieje
) else (
  echo   [2/4] Tworze srodowisko .venv ...
  %PY% -m venv .venv
  if errorlevel 1 goto :err
)

REM ---------------------------------------------------------------- 3. packages
if defined PH_NO_PIP goto :shortcuts
if exist "wheels\*.whl" (
  echo   [3/4] Instaluje pakiety z folderu wheels ^(bez internetu^) ...
  ".venv\Scripts\python.exe" -m pip install --no-index --find-links wheels -r requirements.txt
) else (
  echo   [3/4] Instaluje pakiety z internetu ^(kilka minut^) ...
  ".venv\Scripts\python.exe" -m pip install --upgrade pip
  ".venv\Scripts\python.exe" -m pip install -r requirements.txt
)
if errorlevel 1 goto :err
".venv\Scripts\python.exe" -c "import cv2, mediapipe, fastapi, uvicorn, numpy; print('        pakiety OK')"
if errorlevel 1 goto :err

REM ---------------------------------------------------------------- 4. shortcuts
:shortcuts
echo   [4/4] Tworze skroty (pulpit + menu Start) ...
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\shortcut.ps1" -Target "%~dp0run.bat" -Icon "%~dp0lumo.ico"
if errorlevel 1 echo         (nie udalo sie utworzyc skrotow - uruchamiaj run.bat)

echo.
echo   ================================================
echo     Gotowe!  Uruchom "Lumo" z pulpitu.
echo   ================================================
echo.
echo   Kabel DMX (FTDI / Open DMX): Windows zwykle sam instaluje sterownik po podlaczeniu.
echo   Jesli nie - sterownik "CDM" ze strony ftdichip.com (Drivers - VCP / D2XX).
echo   Kamera z telefonu: Iriun Webcam / DroidCam na telefonie i na komputerze.
echo.
if defined PH_NO_PIP exit /b 0
if defined LUMO_FROM_RUN exit /b 0
choice /C TN /M "  Uruchomic Lumo teraz"
if errorlevel 2 exit /b 0
start "" "%~dp0run.bat"
exit /b 0

REM ---------------------------------------------------------------- helpers
:findpy
for %%c in ("py -3.13" "py -3.12" "py -3.11" "py -3.10" "py -3" "python") do (
  if not defined PY (
    %%~c -c "import sys; sys.exit(0 if sys.version_info[:2] >= (3, 10) else 1)" >nul 2>nul && set "PY=%%~c"
  )
)
exit /b 0

:err
echo.
echo   BLAD instalacji - sprawdz polaczenie z internetem i sprobuj ponownie.
echo   Szczegoly w README.md (rozdzial "Instalacja na innym komputerze").
pause
exit /b 1
