#!/bin/bash

echo "Starting E2E test environment..."

# Start all services
docker compose up -d postgres flyway backend frontend

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 15

# Wait for backend health check
echo "Checking backend health..."
curl -f http://localhost:3000/health || echo "Backend health check failed"

# Wait for frontend to be accessible
echo "Checking frontend accessibility..."
curl -f http://localhost:5173 || echo "Frontend check failed"

# Run E2E tests
echo "Running E2E tests..."
docker compose run --rm --service-ports e2e-tests

# Capture exit code
EXIT_CODE=$?

# Cleanup
echo "Cleaning up..."
docker compose down

exit $EXIT_CODE