@echo off
echo ========================================
echo Docker Desktop Reset Script
echo ========================================
echo.
echo This will fix the "input/output error" on blob storage.
echo.
echo Step 1: Restart Docker Desktop
echo ========================================
echo Right-click Docker Desktop tray icon -^> Troubleshoot -^> Restart
echo.
echo OR if that doesn't work:
echo.
echo Step 2: Reset Docker Desktop to factory defaults
echo ========================================
echo Right-click Docker Desktop tray icon -^> Troubleshoot -^> Reset to factory defaults
echo WARNING: This will delete all images, containers, and volumes!
echo.
echo Step 3: Restart your computer
echo ========================================
echo.
echo Step 4: After reboot, run these commands:
echo ========================================
echo cd /d d:\code\host
echo docker compose pull
echo docker compose up -d
echo docker compose exec api alembic upgrade head
echo.
echo ========================================
echo ALTERNATIVE: Reset via WSL2 directly
echo ========================================
echo If Step 1-3 fails, run in PowerShell as Administrator:
echo.
echo wsl --shutdown
echo wsl -d docker-desktop
echo rm -rf /var/lib/docker
echo exit
echo.
echo The above will delete ALL docker data permanently.
echo.
pause