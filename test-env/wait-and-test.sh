#!/bin/sh

# echo "Waiting for services to be ready..."

# # Wait for backend to be healthy
# echo "Waiting for backend..."
# while ! curl -f http://backend:3000/health > /dev/null 2>&1; do
#   echo "Waiting for backend..."
#   sleep 2
# done

# # Wait for frontend to be ready
# echo "Waiting for frontend..."
# while ! curl -f http://frontend:5173 > /dev/null 2>&1; do
#   echo "Waiting for frontend..."
#   sleep 2
# done

# echo "Services are ready. Running tests..."

# Enable color support
export TERM=xterm-256color
export FORCE_COLOR=1

# Run backend tests
printf "\n\033[1;34m===== BACKEND TESTS =====\033[0m\n"
cd /server
CI=true pnpm install
CI=true pnpm test

# Run frontend tests
printf "\n\033[1;32m===== FRONTEND TESTS =====\033[0m\n"
cd /frontend
CI=true pnpm install
CI=true pnpm test

printf "\n\033[1;36m===== All tests completed! =====\033[0m\n"