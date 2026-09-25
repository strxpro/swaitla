@echo off
REM Lumo - usuwa skroty i srodowisko .venv (ustawienia, pokazy i efekty zostaja).
cd /d "%~dp0"
choice /C TN /M "Usunac Lumo z tego komputera (skroty + .venv)"
if errorlevel 2 exit /b 0
powershell -NoProfile -ExecutionPolicy Bypass -File "tools\shortcut.ps1" -Remove
if exist ".venv" rmdir /s /q ".venv"
reg delete "HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\Lumo" /f >nul 2>nul
echo.
echo Usunieto. Folder z ustawieniami i pokazami mozesz skasowac recznie albo zachowac.
pause
