@echo off
REM Lumo-Setup.exe runs this after IExpress unpacked the files into a temp folder.
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -WindowStyle Hidden -File "%~dp0setup.ps1"
