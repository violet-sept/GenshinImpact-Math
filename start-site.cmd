@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo   Discrete Lab - local launcher
echo ==========================================
echo.

rem Point the wallpaper at the LOCAL video in public\wallpaper\.
rem That video is deliberately NOT in the git repo (135MB is over GitHub's
rem 100MB per-file limit), so a plain production build ships without any
rem wallpaper. This launcher is a local convenience, so it uses the local
rem copy when one is present. If the file is missing, the page notices the
rem load failure and falls back to a solid background on its own.
set "VITE_WALLPAPER_URL=./wallpaper/nahida.mp4"

if not exist "dist\index.html" (
  echo [1/2] First run: building, this takes 10-30s...
  call npm run build:shim
  if errorlevel 1 goto :fail
) else (
  echo [1/2] Build found. Delete the "dist" folder to rebuild.
)

echo [2/2] Starting local server...
start "Discrete Lab server (close this window to stop)" /min cmd /c "npm run preview:shim"

set READY=0
for /l %%i in (1,1,25) do (
  powershell -NoProfile -Command "try{if((Invoke-WebRequest -Uri 'http://localhost:4173/' -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200){exit 0}}catch{}; exit 1" >nul 2>&1
  if not errorlevel 1 (
    set READY=1
    goto :open
  )
  timeout /t 1 /nobreak >nul
)

:open
if "%READY%"=="1" goto :opened
echo.
echo Server did not start within 25 seconds.
echo Check the minimized "Discrete Lab server" window for errors.
pause
exit /b 1

:opened
echo.
echo Ready. Opening http://localhost:4173/
start "" "http://localhost:4173/"
echo.
echo To stop the server, close the minimized "Discrete Lab server" window.
timeout /t 5 /nobreak >nul
exit /b 0

:fail
echo.
echo Build failed. See the errors above.
pause
exit /b 1
