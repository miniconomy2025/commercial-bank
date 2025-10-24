#!/bin/bash

echo "Waiting for backend to be ready..."
until curl -f http://backend:3000/health > /dev/null 2>&1; do
  echo "Backend not ready, waiting..."
  sleep 2
done
echo "Backend is ready!"

echo "Waiting for frontend to be ready..."
until curl -f http://frontend:5173 > /dev/null 2>&1; do
  echo "Frontend not ready, waiting..."
  sleep 2
done
echo "Frontend is ready!"

echo "All services are ready, starting tests..."