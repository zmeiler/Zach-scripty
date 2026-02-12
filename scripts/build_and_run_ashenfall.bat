@echo off
setlocal

REM Ashenfall Windows build+run helper.
REM Usage:
REM   build_and_run_ashenfall.bat [seed] [days] [--show-log]

set SEED=%~1
if "%SEED%"=="" set SEED=9

set DAYS=%~2
if "%DAYS%"=="" set DAYS=18

set SHOWLOG=%~3

where py >nul 2>nul
if %errorlevel% neq 0 (
  echo [ERROR] Python launcher 'py' was not found. Install Python 3.11+ and retry.
  exit /b 1
)

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Creating virtual environment...
  py -3 -m venv .venv
  if %errorlevel% neq 0 exit /b %errorlevel%
)

echo [INFO] Installing package and dependencies...
call .venv\Scripts\python.exe -m pip install --upgrade pip
if %errorlevel% neq 0 exit /b %errorlevel%
call .venv\Scripts\python.exe -m pip install -e . pytest
if %errorlevel% neq 0 exit /b %errorlevel%

echo [INFO] Running test suite...
call .venv\Scripts\python.exe -m pytest -q
if %errorlevel% neq 0 exit /b %errorlevel%

echo [INFO] Launching Ashenfall...
if /I "%SHOWLOG%"=="--show-log" (
  call .venv\Scripts\python.exe -m engine3d.cli --seed %SEED% --days %DAYS% --show-log
) else (
  call .venv\Scripts\python.exe -m engine3d.cli --seed %SEED% --days %DAYS%
)

exit /b %errorlevel%
