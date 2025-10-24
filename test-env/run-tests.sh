#!/usr/bin/env bash

set -e

echo "🚀 Starting Docker test environment..."

# Check and enable buildx if not available
# if ! docker buildx version >/dev/null 2>&1; then
#     echo "Enabling Docker buildx..."
#     docker buildx install
# fi

# export COMPOSE_BAKE=true

# Clean up any existing containers
docker compose down -v

# Build and start services

docker compose up --build -d postgres backend frontend
echo "Waiting for services to start..."

sleep 8
printf "\n\033[1;33m===== BACKEND LOGS =====\033[0m\n"
docker compose logs backend

printf "\n\033[1;35m===== FRONTEND LOGS =====\033[0m\n"
docker compose logs frontend

printf "\n\033[1;36m===== CONTAINER STATUS =====\033[0m\n"
docker compose ps

docker compose build --no-cache test-runner
docker compose up test-runner

# Clean up
echo "🧹 Cleaning up..."
docker compose down -v

echo "✅ Test environment completed!"