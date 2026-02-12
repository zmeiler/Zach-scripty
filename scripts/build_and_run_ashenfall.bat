@echo off
setlocal enableextensions

REM Ashenfall Windows build+run helper.
REM Usage:
REM   build_and_run_ashenfall.bat [seed] [days] [--show-log] [--debug]

set SEED=%~1
if "%SEED%"=="" set SEED=9

set DAYS=%~2
if "%DAYS%"=="" set DAYS=18

set SHOWLOG=%~3
set DEBUG=%~4

set PYTHON_CMD=
where py >nul 2>nul
if %errorlevel%==0 (
  set PYTHON_CMD=py -3
) else (
  where python >nul 2>nul
  if %errorlevel%==0 (
    set PYTHON_CMD=python
  ) else (
    echo [ERROR] No Python runtime found. Install Python 3.11+ and retry.
    exit /b 1
  )
)

echo [INFO] Using Python command: %PYTHON_CMD%
%PYTHON_CMD% --version
if %errorlevel% neq 0 goto :fail

if not exist ".venv\Scripts\python.exe" (
  echo [INFO] Creating virtual environment...
  %PYTHON_CMD% -m venv .venv
  if %errorlevel% neq 0 goto :fail
)

echo [INFO] Upgrading pip...
call .venv\Scripts\python.exe -m pip install --upgrade pip
if %errorlevel% neq 0 goto :fail

echo [INFO] Installing package and dependencies...
call .venv\Scripts\python.exe -m pip install -e . pytest
if %errorlevel% neq 0 goto :fail

echo [INFO] Verifying engine module import...
call .venv\Scripts\python.exe -c "import engine3d; print('engine3d import OK')"
if %errorlevel% neq 0 goto :diagnose

echo [INFO] Running test suite...
call .venv\Scripts\python.exe -m pytest -q
if %errorlevel% neq 0 goto :fail

echo [INFO] Launching Ashenfall with seed=%SEED% days=%DAYS%...
if /I "%SHOWLOG%"=="--show-log" (
  call .venv\Scripts\python.exe -m engine3d.cli --seed %SEED% --days %DAYS% --show-log
) else (
  call .venv\Scripts\python.exe -m engine3d.cli --seed %SEED% --days %DAYS%
)
if %errorlevel% neq 0 goto :diagnose

echo [INFO] Completed successfully.
exit /b 0

:diagnose
echo [WARN] Launch failed. Collecting diagnostics...
call .venv\Scripts\python.exe --version
call .venv\Scripts\python.exe -m pip --version
call .venv\Scripts\python.exe -m pip list
call .venv\Scripts\python.exe -c "import sys; print('sys.path='); [print('  '+p) for p in sys.path]"
call .venv\Scripts\python.exe -m engine3d.cli --seed 1 --days 1
if /I "%DEBUG%"=="--debug" pause
goto :fail

:fail
echo [ERROR] build_and_run_ashenfall.bat failed with exit code %errorlevel%.
if /I "%DEBUG%"=="--debug" pause
exit /b %errorlevel%
