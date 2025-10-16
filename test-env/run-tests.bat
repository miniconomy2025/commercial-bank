@echo off
setlocal enabledelayedexpansion

echo 🚀 Starting Docker test environment...

REM Clean up any existing containers
docker compose down -v

REM Build and start services
docker compose up --build -d postgres flyway backend frontend
echo Waiting for services to start...

timeout /t 8 /nobreak >nul

echo.
echo ===== BACKEND LOGS =====
docker compose logs backend

echo.
echo ===== FRONTEND LOGS =====
docker compose logs frontend

echo.
echo ===== CONTAINER STATUS =====
docker compose ps

docker compose up test-runner

REM Clean up
echo 🧹 Cleaning up...
docker compose down -v

echo ✅ Test environment completed!