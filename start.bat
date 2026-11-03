@echo off
rem Double-click to install everything and open the showroom.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Installing Node.js...
  winget install --id OpenJS.NodeLTS --exact --silent --accept-package-agreements --accept-source-agreements
  set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
where node >nul 2>nul
if errorlevel 1 (
  echo Could not install Node.js. Get it from https://nodejs.org and run this again.
  pause
  exit /b 1
)
node tools\start.mjs %*
if errorlevel 1 pause
