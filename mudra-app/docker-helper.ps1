# ============================================
# Docker Helper Script for Mudra App (PowerShell)
# Enhanced with Debugging & Tailwind Fix
# ============================================

# Colors for output
function Show-SuccessMessage {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Show-ErrorMessage {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Show-InfoMessage {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Yellow
}

function Show-DebugMessage {
    param([string]$Message)
    Write-Host "[DEBUG] $Message" -ForegroundColor Cyan
}

function Show-WarningMessage {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Magenta
}

# Check if Docker is running
function Test-Docker {
    try {
        $null = docker info 2>&1
        if ($LASTEXITCODE -eq 0) {
            Show-SuccessMessage "Docker is running"
            return $true
        }
    }
    catch {
        Show-ErrorMessage "Docker is not running. Please start Docker Desktop and try again."
        exit 1
    }
}

# Debug: Check Tailwind version
function Test-TailwindVersion {
    Show-DebugMessage "Checking Tailwind CSS version..."
    
    if (Test-Path "package.json") {
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        $tailwindVersion = $packageJson.devDependencies.tailwindcss
        
        if ($tailwindVersion -like "*4*" -or $null -ne $packageJson.devDependencies.'@tailwindcss/postcss') {
            Show-WarningMessage "Tailwind CSS v4 detected - this may cause native binding issues in Docker"
            Show-InfoMessage "Recommendation: Run 'fix-tailwind' command to downgrade to v3"
            return $false
        } else {
            Show-SuccessMessage "Tailwind CSS v3 detected (compatible)"
            return $true
        }
    } else {
        Show-ErrorMessage "package.json not found"
        return $false
    }
}

# Fix Tailwind CSS version
function Repair-TailwindVersion {
    Show-InfoMessage "Downgrading Tailwind CSS to v3 for Docker compatibility..."
    
    # Uninstall v4 packages
    npm uninstall tailwindcss @tailwindcss/postcss @tailwindcss/oxide
    
    # Install v3
    npm install -D tailwindcss@^3 postcss autoprefixer
    
    # Generate config
    npx tailwindcss init -p
    
    Show-SuccessMessage "Tailwind CSS downgraded to v3"
    Show-InfoMessage "Please rebuild your Docker image: .\docker-helper.ps1 rebuild-dev"
}

# Debug: Show environment info
function Show-EnvironmentInfo {
    Show-DebugMessage "=== Environment Information ==="
    
    Write-Host "`nNode Version (Host):" -ForegroundColor Cyan
    node --version
    
    Write-Host "`nNPM Version (Host):" -ForegroundColor Cyan
    npm --version
    
    Write-Host "`nDocker Version:" -ForegroundColor Cyan
    docker --version
    
    Write-Host "`nDocker Compose Version:" -ForegroundColor Cyan
    docker-compose --version
    
    Write-Host "`nOperating System:" -ForegroundColor Cyan
    Write-Host "$([System.Environment]::OSVersion.VersionString)"
    
    if (Test-Path "package.json") {
        Write-Host "`nProject Dependencies:" -ForegroundColor Cyan
        $packageJson = Get-Content "package.json" -Raw | ConvertFrom-Json
        Write-Host "  Next.js: $($packageJson.dependencies.next)"
        Write-Host "  React: $($packageJson.dependencies.react)"
        Write-Host "  Tailwind: $($packageJson.devDependencies.tailwindcss)"
    }
    
    Write-Host ""
}

# Debug: Check Docker container logs with error filtering
function Show-ContainerErrors {
    param([string]$Environment = "dev")
    
    $composeFile = if ($Environment -eq "dev") { "docker-compose.dev.yml" } else { "docker-compose.yml" }
    
    Show-DebugMessage "Checking for errors in container logs..."
    
    $logs = docker-compose -f $composeFile logs app 2>&1 | Select-String -Pattern "error|fail|exception" -CaseSensitive:$false
    
    if ($logs) {
        Show-ErrorMessage "Errors found in logs:"
        $logs | ForEach-Object { Write-Host $_ -ForegroundColor Red }
    } else {
        Show-SuccessMessage "No errors found in recent logs"
    }
}

# Clean node_modules and reinstall inside container
function Repair-NodeModules {
    param([string]$Environment = "dev")
    
    $composeFile = if ($Environment -eq "dev") { "docker-compose.dev.yml" } else { "docker-compose.yml" }
    
    Show-InfoMessage "Cleaning and reinstalling node_modules in container..."
    
    # Remove host node_modules to prevent conflicts
    if (Test-Path "node_modules") {
        Show-DebugMessage "Removing host node_modules..."
        Remove-Item -Path "node_modules" -Recurse -Force
    }
    
    # Rebuild container and reinstall
    docker-compose -f $composeFile down
    docker-compose -f $composeFile build --no-cache
    
    Show-SuccessMessage "Container rebuilt with fresh dependencies"
}

# Build development image
function Build-DevImage {
    Show-InfoMessage "Building development image..."
    docker-compose -f docker-compose.dev.yml build --no-cache
    if ($LASTEXITCODE -eq 0) {
        Show-SuccessMessage "Development image built successfully"
    } else {
        Show-ErrorMessage "Failed to build development image"
        Show-InfoMessage "Run '.\docker-helper.ps1 debug' for more information"
        exit 1
    }
}

# Build production image
function Build-ProdImage {
    Show-InfoMessage "Building production image..."
    docker-compose -f docker-compose.yml build --no-cache
    if ($LASTEXITCODE -eq 0) {
        Show-SuccessMessage "Production image built successfully"
    } else {
        Show-ErrorMessage "Failed to build production image"
        Show-InfoMessage "Run '.\docker-helper.ps1 debug' for more information"
        exit 1
    }
}

# Rebuild with clean slate
function Rebuild-DevImage {
    Show-InfoMessage "Performing complete rebuild (dev)..."
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.dev.yml build --no-cache --pull
    Show-SuccessMessage "Rebuild complete"
}

function Rebuild-ProdImage {
    Show-InfoMessage "Performing complete rebuild (prod)..."
    docker-compose -f docker-compose.yml down -v
    docker-compose -f docker-compose.yml build --no-cache --pull
    Show-SuccessMessage "Rebuild complete"
}

# Start development environment
function Start-DevEnvironment {
    Show-InfoMessage "Starting development environment..."
    docker-compose -f docker-compose.dev.yml up -d
    if ($LASTEXITCODE -eq 0) {
        Show-SuccessMessage "Development environment started"
        Show-InfoMessage "Access the app at: http://localhost:3000"
        Show-InfoMessage "View logs with: .\docker-helper.ps1 logs-dev"
        
        # Wait a moment and check for immediate errors
        Start-Sleep -Seconds 3
        Show-ContainerErrors -Environment "dev"
    } else {
        Show-ErrorMessage "Failed to start development environment"
        Show-ContainerErrors -Environment "dev"
        exit 1
    }
}

# Start production environment
function Start-ProdEnvironment {
    Show-InfoMessage "Starting production environment..."
    docker-compose -f docker-compose.yml up -d
    if ($LASTEXITCODE -eq 0) {
        Show-SuccessMessage "Production environment started"
        Show-InfoMessage "Access the app at: http://localhost:3000"
        
        # Wait a moment and check for immediate errors
        Start-Sleep -Seconds 3
        Show-ContainerErrors -Environment "prod"
    } else {
        Show-ErrorMessage "Failed to start production environment"
        Show-ContainerErrors -Environment "prod"
        exit 1
    }
}

# Stop development environment
function Stop-DevEnvironment {
    Show-InfoMessage "Stopping development environment..."
    docker-compose -f docker-compose.dev.yml down
    Show-SuccessMessage "Development environment stopped"
}

# Stop production environment
function Stop-ProdEnvironment {
    Show-InfoMessage "Stopping production environment..."
    docker-compose -f docker-compose.yml down
    Show-SuccessMessage "Production environment stopped"
}

# View logs (development)
function Show-DevLogs {
    docker-compose -f docker-compose.dev.yml logs -f app
}

# View logs (production)
function Show-ProdLogs {
    docker-compose -f docker-compose.yml logs -f app
}

# Show last N lines of logs
function Show-DevLogsTail {
    param([int]$Lines = 50)
    docker-compose -f docker-compose.dev.yml logs --tail=$Lines app
}

function Show-ProdLogsTail {
    param([int]$Lines = 50)
    docker-compose -f docker-compose.yml logs --tail=$Lines app
}

# Restart development
function Restart-DevEnvironment {
    Stop-DevEnvironment
    Start-DevEnvironment
}

# Restart production
function Restart-ProdEnvironment {
    Stop-ProdEnvironment
    Start-ProdEnvironment
}

# Clean up Docker resources
function Clear-DockerResources {
    Show-InfoMessage "Cleaning up Docker resources..."
    docker-compose -f docker-compose.dev.yml down -v
    docker-compose -f docker-compose.yml down -v
    docker system prune -f
    Show-SuccessMessage "Cleanup complete"
}

# Deep clean (nuclear option)
function Clear-DockerDeep {
    Show-WarningMessage "This will remove ALL Docker resources (images, containers, volumes, networks)"
    $confirm = Read-Host "Are you sure? (yes/no)"
    
    if ($confirm -eq "yes") {
        Show-InfoMessage "Performing deep clean..."
        docker-compose -f docker-compose.dev.yml down -v --rmi all
        docker-compose -f docker-compose.yml down -v --rmi all
        docker system prune -af --volumes
        Show-SuccessMessage "Deep clean complete"
    } else {
        Show-InfoMessage "Deep clean cancelled"
    }
}

# Health check
function Test-ApplicationHealth {
    Show-InfoMessage "Checking application health..."
    try {
        $response = Invoke-WebRequest -Uri "http://localhost:3000/api/health" -UseBasicParsing -ErrorAction Stop -TimeoutSec 10
        if ($response.StatusCode -eq 200) {
            Show-SuccessMessage "Application is healthy (HTTP $($response.StatusCode))"
            $content = $response.Content | ConvertFrom-Json
            Write-Host ($content | ConvertTo-Json -Depth 10)
        }
    }
    catch {
        Show-ErrorMessage "Application is unhealthy: $($_.Exception.Message)"
        Show-InfoMessage "Try checking logs: .\docker-helper.ps1 logs-dev"
        exit 1
    }
}

# Shell into running container (development)
function Enter-DevShell {
    docker-compose -f docker-compose.dev.yml exec app sh
}

# Shell into running container (production)
function Enter-ProdShell {
    docker-compose -f docker-compose.yml exec app sh
}

# Run Prisma commands
function Invoke-PrismaGenerate {
    docker-compose -f docker-compose.dev.yml exec app npx prisma generate
}

function Invoke-PrismaStudio {
    Show-InfoMessage "Starting Prisma Studio (will open in browser)..."
    docker-compose -f docker-compose.dev.yml exec app npx prisma studio
}

function Invoke-PrismaMigrate {
    docker-compose -f docker-compose.dev.yml exec app npx prisma migrate dev
}

# Quick diagnostic
function Invoke-QuickDiagnostic {
    Show-DebugMessage "=== Quick Diagnostic ==="
    Write-Host ""
    
    # Check Docker
    Test-Docker
    Write-Host ""
    
    # Check Tailwind version
    Test-TailwindVersion
    Write-Host ""
    
    # Check if containers are running
    Show-DebugMessage "Checking running containers..."
    $devRunning = docker-compose -f docker-compose.dev.yml ps --services --filter "status=running" 2>$null
    $prodRunning = docker-compose -f docker-compose.yml ps --services --filter "status=running" 2>$null
    
    if ($devRunning) {
        Show-SuccessMessage "Development containers running"
    } else {
        Show-InfoMessage "Development containers not running"
    }
    
    if ($prodRunning) {
        Show-SuccessMessage "Production containers running"
    } else {
        Show-InfoMessage "Production containers not running"
    }
    
    Write-Host ""
    
    # Show recent errors
    if ($devRunning) {
        Show-ContainerErrors -Environment "dev"
    }
}

# Show usage
function Show-Usage {
    Write-Host @"

Mudra Docker Helper Script (PowerShell) - Enhanced Edition

Usage: .\docker-helper.ps1 [command]

Commands:
  Development:
    build-dev       Build development Docker image
    rebuild-dev     Complete rebuild (clean slate)
    start-dev       Start development environment
    stop-dev        Stop development environment
    restart-dev     Restart development environment
    logs-dev        View development logs (follow)
    logs-tail-dev   View last 50 lines of dev logs
    shell-dev       Open shell in development container

  Production:
    build-prod      Build production Docker image
    rebuild-prod    Complete rebuild (clean slate)
    start-prod      Start production environment
    stop-prod       Stop production environment
    restart-prod    Restart production environment
    logs-prod       View production logs (follow)
    logs-tail-prod  View last 50 lines of prod logs
    shell-prod      Open shell in production container

  Database (Prisma):
    prisma-generate Generate Prisma client
    prisma-studio   Open Prisma Studio
    prisma-migrate  Run Prisma migrations

  Debugging & Fixes:
    debug           Run complete diagnostic
    check-env       Show environment information
    check-tailwind  Check Tailwind CSS version
    fix-tailwind    Downgrade Tailwind to v3 (Docker-compatible)
    fix-modules     Rebuild container with fresh node_modules
    check-errors    Show recent container errors

  Utilities:
    health          Check application health
    cleanup         Clean up Docker resources
    deep-clean      Remove ALL Docker resources (nuclear option)
    help            Show this help message

Examples:
  # Quick start for development
  .\docker-helper.ps1 rebuild-dev
  .\docker-helper.ps1 start-dev
  
  # Fix Tailwind native binding error
  .\docker-helper.ps1 fix-tailwind
  .\docker-helper.ps1 rebuild-dev
  
  # Diagnose issues
  .\docker-helper.ps1 debug
  .\docker-helper.ps1 check-errors
  .\docker-helper.ps1 logs-tail-dev

"@
}

# Main script
function Invoke-Main {
    param([string]$Command)

    # Check Docker first (except for help)
    if ($Command -ne "help" -and $Command -ne "") {
        Test-Docker
    }

    switch ($Command) {
        "build-dev" { Build-DevImage }
        "build-prod" { Build-ProdImage }
        "rebuild-dev" { Rebuild-DevImage }
        "rebuild-prod" { Rebuild-ProdImage }
        "start-dev" { Start-DevEnvironment }
        "start-prod" { Start-ProdEnvironment }
        "stop-dev" { Stop-DevEnvironment }
        "stop-prod" { Stop-ProdEnvironment }
        "restart-dev" { Restart-DevEnvironment }
        "restart-prod" { Restart-ProdEnvironment }
        "logs-dev" { Show-DevLogs }
        "logs-prod" { Show-ProdLogs }
        "logs-tail-dev" { Show-DevLogsTail }
        "logs-tail-prod" { Show-ProdLogsTail }
        "shell-dev" { Enter-DevShell }
        "shell-prod" { Enter-ProdShell }
        "prisma-generate" { Invoke-PrismaGenerate }
        "prisma-studio" { Invoke-PrismaStudio }
        "prisma-migrate" { Invoke-PrismaMigrate }
        "health" { Test-ApplicationHealth }
        "cleanup" { Clear-DockerResources }
        "deep-clean" { Clear-DockerDeep }
        "debug" { Invoke-QuickDiagnostic }
        "check-env" { Show-EnvironmentInfo }
        "check-tailwind" { Test-TailwindVersion }
        "fix-tailwind" { Repair-TailwindVersion }
        "fix-modules" { Repair-NodeModules -Environment "dev" }
        "check-errors" { Show-ContainerErrors -Environment "dev" }
        "help" { Show-Usage }
        default {
            Show-ErrorMessage "Unknown command: $Command"
            Write-Host ""
            Show-Usage
            exit 1
        }
    }
}

# Run main function with first argument
if ($args.Count -eq 0) {
    Show-Usage
    exit 0
}

Invoke-Main -Command $args[0]