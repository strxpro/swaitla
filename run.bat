@echo off
setlocal EnableExtensions
REM Lumo launcher (Windows). Extra args are passed through, e.g.:
REM   run.bat --source 1
REM  - first start on a computer: installs everything by itself (instaluj.bat)
REM  - the same Lumo already running: just opens the browser
REM  - an older Lumo still running (after "git pull" / an update): closes it and starts the new one
cd /d "%~dp0"
set "LUMO_VER="
if exist VERSION set /p LUMO_VER=<VERSION
powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-WebRequest http://127.0.0.1:8000/api/state -TimeoutSec 2 -UseBasicParsing | Out-Null } catch { exit 1 }; try { $v = (Invoke-RestMethod http://127.0.0.1:8000/api/version -TimeoutSec 2).version } catch { $v = '' }; if ($v -eq '%LUMO_VER%') { exit 0 } else { exit 2 }"
set "STATE=%errorlevel%"
if "%STATE%"=="0" (
  echo Lumo juz dziala - otwieram przegladarke.
  start "" http://127.0.0.1:8000
  goto :eof
)
if "%STATE%"=="2" (
  echo Dziala starsza wersja Lumo - zamykam ja i uruchamiam nowa...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; if ($p -and $p.ProcessName -like 'python*') { Stop-Process -Id $p.Id -Force } }; Start-Sleep -Seconds 2"
)
if not exist ".venv\Scripts\python.exe" (
  echo Pierwsze uruchomienie na tym komputerze - instaluje Lumo ^(kilka minut^)...
  set "LUMO_FROM_RUN=1"
  call "%~dp0instaluj.bat"
  if not exist ".venv\Scripts\python.exe" goto :err
)
".venv\Scripts\python.exe" main.py --open %*
if errorlevel 1 goto :err
goto :eof
:err
echo.
echo Lumo nie wystartowalo. Sprawdz komunikat powyzej albo README.md (Instalacja na innym komputerze).
pause
