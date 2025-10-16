@echo off
setlocal enabledelayedexpansion

echo Wiping Docker test environment...

REM Stop and remove all containers
docker compose down -v

REM Remove all test-env images
for /f "tokens=3" %%i in ('docker images 2^>nul ^| findstr test-env 2^>nul') do (
    if not "%%i"=="" docker rmi -f %%i 2>nul
)

REM Clean up Docker system
docker system prune -f

echo Environment wiped! Next run will do a full rebuild. o7