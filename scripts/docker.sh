#!/usr/bin/env bash

set -euo pipefail

COMMAND=${1:-}

# Handle both "docker compose" and "docker-compose"
if command -v docker-compose &> /dev/null; then
  DOCKER_CMD="docker-compose"
elif docker compose version &> /dev/null; then
  DOCKER_CMD="docker compose"
else
  echo "Error: Neither 'docker compose' nor 'docker-compose' found. Please install Docker Compose."
  exit 1
fi

case "$COMMAND" in
  start)
    echo "Starting Docker environment..."
    $DOCKER_CMD up -d --build
    
    echo "--------------------------------------------------------"
    echo "✅ App is starting up!"
    echo "🌍 Web App will be available at: http://localhost:8080"
    echo "📊 API is running internally on port 3000"
    echo "--------------------------------------------------------"
    ;;
  stop)
    echo "Stopping Docker environment..."
    $DOCKER_CMD down
    echo "✅ Docker stopped."
    ;;
  restart)
    echo "Restarting Docker environment..."
    $DOCKER_CMD down
    $DOCKER_CMD up -d --build
    ;;
  logs)
    $DOCKER_CMD logs -f
    ;;
  *)
    echo "Usage: pnpm docker {start|stop|restart|logs}"
    echo "   or: ./scripts/docker.sh {start|stop|restart|logs}"
    exit 1
    ;;
esac
