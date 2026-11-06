@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js 22 or newer is required.
  pause
  exit /b 1
)
echo Starting WebPainter from the current source, using normal preferences...
node scripts\start-current.mjs
if errorlevel 1 (
  echo Startup failed. See the messages above.
  pause
  exit /b 1
)
endlocal
