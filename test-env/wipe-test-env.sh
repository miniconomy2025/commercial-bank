#!/usr/bin/env bash

set -e

echo "🗑️  Wiping Docker test environment..."

# Stop and remove all containers
docker compose down -v

# Remove all test-env images
docker images | grep test-env | awk '{print $3}' | xargs -r docker rmi -f

# Clean up Docker system
docker system prune -f

echo "✅ Environment wiped! Next run will do a full rebuild. o7"