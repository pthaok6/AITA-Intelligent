@echo off
setlocal
cd /d "%~dp0"
title Cloudflare Tunnel - Backend Port 5000

echo ========================================================
echo        DANG KHOI DONG CLOUDFLARE TUNNEL (PORT 5000)
echo ========================================================
echo.
echo [Luu y] Backend (port 5000) can duoc bat truoc khi dung tunnel.
echo Duong link cong khai co dang:
echo   https://xxxxxxxx.trycloudflare.com
echo.
echo ========================================================
echo.

where cloudflared >nul 2>&1
if errorlevel 1 (
    if exist "C:\Program Files (x86)\cloudflared\cloudflared.exe" (
        "C:\Program Files (x86)\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:5000
    ) else if exist "C:\Program Files\cloudflared\cloudflared.exe" (
        "C:\Program Files\cloudflared\cloudflared.exe" tunnel --url http://127.0.0.1:5000
    ) else (
        echo [ERROR] Khong tim thay cloudflared.exe!
        pause
        exit /b 1
    )
) else (
    cloudflared tunnel --url http://127.0.0.1:5000
)

pause
