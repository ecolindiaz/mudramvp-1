#!/bin/bash

# ============================================
# Docker Helper Script for Mudra App
# ============================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ $1${NC}"
}

# Check if Docker is running
check_docker() {
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    print_success "Docker is running"
}

# Build development image
build_dev() {
    print_info "Building development image..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    print_success "Development image built successfully"
}

# Build production image
build_prod() {
    print_info "Building production image..."
    docker-compose -f docker-compose.yml build --no-cache
    print_success "Production image built successfully"
}

# Start development environment
start_dev() {
    print_info "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    print_success "Development environment started"
    print_info "Access the app at: http://localhost:3000"
    print_info "View logs with: ./docker-helper.sh logs-dev"
}

# Start production environment
start_prod() {
    print_info "Starting production environment..."
    docker-compose -f docker-compose.yml up -d
    print_success "Production environment started"
    print_info "Access the app at: http://localhost:3000"
}

# Stop development environment
stop_dev() {
    print_info "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    print_success "Development environment stopped"
}

# Stop production environment
stop_prod() {
    print_info "Stopping production environment..."
    docker-compose -f docker-compose.yml down
    print_success "Production environment stopped"
}

# View logs (development)
logs_dev() {
    docker-compose -f docker-compose.dev.yml logs -f app
}

# View logs (production)
logs_prod() {
    docker-compose -f docker-compose.yml logs -f app
}

# Restart development
restart_dev() {
    stop_dev
    start_dev
}

# Restart production
restart_prod() {
    stop_prod
    start_prod
}

# Clean up Docker resources
cleanup() {
    print_info "Cleaning up Docker resources..."
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.yml down -v
    docker system prune -f
    print_success "Cleanup complete"
}

# Health check
health_check() {
    print_info "Checking application health..."
    response=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health)
    
    if [ "$response" = "200" ]; then
        print_success "Application is healthy (HTTP $response)"
    else
        print_error "Application is unhealthy (HTTP $response)"
        exit 1
    fi
}

# Shell into running container
shell_dev() {
    docker-compose -f docker-compose.dev.yml exec app sh
}

shell_prod() {
    docker-compose -f docker-compose.yml exec app sh
}

# Run Prisma commands in container
prisma_generate() {
    docker-compose -f docker-compose.dev.yml exec app npx prisma generate
}

prisma_studio() {
    docker-compose -f docker-compose.dev.yml exec app npx prisma studio
}

prisma_migrate() {
    docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev
}

# Show usage
usage() {
    cat << EOF
Mudra Docker Helper Script

Usage: ./docker-helper.sh [command]

Commands:
  Development:
    build-dev       Build development Docker image
    start-dev       Start development environment
    stop-dev        Stop development environment
    restart-dev     Restart development environment
    logs-dev        View development logs (follow)
    shell-dev       Open shell in development container

  Production:
    build-prod      Build production Docker image
    start-prod      Start production environment
    stop-prod       Stop production environment
    restart-prod    Restart production environment
    logs-prod       View production logs (follow)
    shell-prod      Open shell in production container

  Database (Prisma):
    prisma-generate Generate Prisma client
    prisma-studio   Open Prisma Studio
    prisma-migrate  Run Prisma migrations

  Utilities:
    health          Check application health
    cleanup         Clean up Docker resources
    help            Show this help message

Examples:
  ./docker-helper.sh build-dev
  ./docker-helper.sh start-dev
  ./docker-helper.sh logs-dev
  ./docker-helper.sh health

EOF
}

# Main script
main() {
    check_docker
    
    case "$1" in
        build-dev)
            build_dev
            ;;
        build-prod)
            build_prod
            ;;
        start-dev)
            start_dev
            ;;
        start-prod)
            start_prod
            ;;
        stop-dev)
            stop_dev
            ;;
        stop-prod)
            stop_prod
            ;;
        restart-dev)
            restart_dev
            ;;
        restart-prod)
            restart_prod
            ;;
        logs-dev)
            logs_dev
            ;;
        logs-prod)
            logs_prod
            ;;
        shell-dev)
            shell_dev
            ;;
        shell-prod)
            shell_prod
            ;;
        prisma-generate)
            prisma_generate
            ;;
        prisma-studio)
            prisma_studio
            ;;
        prisma-migrate)
            prisma_migrate
            ;;
        health)
            health_check
            ;;
        cleanup)
            cleanup
            ;;
        help|--help|-h)
            usage
            ;;
        *)
            print_error "Unknown command: $1"
            echo ""
            usage
            exit 1
            ;;
    esac
}

# Run main function
main "$@"
