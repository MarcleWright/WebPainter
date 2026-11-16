@echo off
setlocal
cd /d "%~dp0"
title WebPainter - current checkout development
echo Source directory: %CD%
echo Frontend edits reload automatically through Vite.
echo Electron main/preload edits require restarting this script.
echo.
if not exist "node_modules\vite\package.json" (
  echo Dependencies are missing. Run npm ci in this directory first.
  pause
  exit /b 1
)
call "%~dp0Start-WebPainter.bat"
exit /b %errorlevel%
