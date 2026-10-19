@echo off
setlocal
cd /d "%~dp0"
title AITA - Start All

where docker >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Khong tim thay Docker. Hay cai Docker Desktop va mo Docker Desktop truoc.
  goto failed
)

where npm.cmd >nul 2>&1
if errorlevel 1 (
  where npm >nul 2>&1
  if errorlevel 1 (
    echo [ERROR] Khong tim thay npm hoac npm.cmd. Hay cai Node.js va npm truoc.
    goto failed
  )
)

if not exist ".env" (
  echo [ERROR] Chua co file .env o thu muc goc.
  echo Tao file .env theo huong dan trong README.md roi chay lai.
  goto failed
)

if not exist "apps\backend\.env" (
  echo [ERROR] Chua co file apps\backend\.env.
  echo Tao file nay theo huong dan trong README.md roi chay lai.
  goto failed
)

echo.
echo [1/4] Dang khoi dong PostgreSQL va Redis...
docker compose up -d --wait postgres redis
if errorlevel 1 goto failed

echo.
echo [2/4] Dang cap nhat database va Prisma Client...
call npm.cmd run db:setup
if errorlevel 1 goto failed

echo.
echo [3/5] Dang kiem tra Sandbox Runner Python...
docker image inspect aita-runner-python:1 >nul 2>&1
if errorlevel 1 (
  echo Dang build Docker Runner cho Python...
  docker compose --profile runners build runner-python
)
if errorlevel 1 goto failed

echo.
echo [4/5] Dang mo Prisma Studio tai http://localhost:5555...
start "Prisma Studio" cmd /k "npm.cmd run db:studio"

echo.
echo [5/5] Dang khoi dong API, worker va frontend...
echo Frontend: http://localhost:5173
echo API:      http://localhost:5000/api/health
echo Prisma:   http://localhost:5555
echo Nhan Ctrl+C de dung, hoac chay file stop-all.bat de tat toan bo nhanh chong.
call npm.cmd start
set "EXIT_CODE=%ERRORLEVEL%"
exit /b %EXIT_CODE%

:failed
echo.
echo Khoi dong that bai. Kiem tra loi ben tren va thu chay lai start-all.bat.
pause
exit /b 1
