@echo off
REM Lumo - tworzy paczke ZIP do instalacji na innym komputerze (folder dist).
cd /d "%~dp0"
title Lumo - paczka instalacyjna
if not exist ".venv\Scripts\python.exe" (
  echo Najpierw zainstaluj program ^(instaluj.bat^).
  pause
  exit /b 1
)
echo.
echo   Jaka paczke zrobic?
echo     1 = czysta instalacja (bez moich lamp i pokazow)
echo     2 = z moimi ustawieniami, efektami i pokazami
echo.
choice /C 12 /M "  Wybierz"
set "ARGS="
if errorlevel 2 set "ARGS=--with-settings"
echo.
echo   Dolaczyc pakiety Pythona? Wtedy drugi komputer nie potrzebuje internetu
echo   (paczka wieksza o ok. 150 MB; pobieranie teraz wymaga internetu).
choice /C TN /M "  Tryb offline"
if not errorlevel 2 set "ARGS=%ARGS% --offline"
".venv\Scripts\python.exe" make_package.py %ARGS%
if errorlevel 1 (
  echo Nie udalo sie zrobic paczki.
  pause
  exit /b 1
)
explorer dist
pause
