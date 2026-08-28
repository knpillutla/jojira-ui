<#
.SYNOPSIS
  Builds jojira-ui Docker image using Azure Container Registry (ACR) and deploys to Azure Container App with Azure Key Vault secrets integration.
#>

param(
  [string]$EnvFile = "$PSScriptRoot\envs\dev.env",
  [string]$GoogleClientId = "",
  [string]$GoogleClientSecret = "",
  [string]$GoogleMapsApiKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " 🚀 Building & Deploying jojira-ui to Azure Container Apps " -ForegroundColor BrightWhite
Write-Host "============================================================" -ForegroundColor Cyan

# 1. Read environment settings
if (Test-Path $EnvFile) {
  Write-Host "📄 Loading parameters from $EnvFile..." -ForegroundColor Gray
  Get-Content $EnvFile | ForEach-Object {
    $line = $_.Trim()
    if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
      $parts = $line.Split("=", 2)
      [Environment]::SetEnvironmentVariable($parts[0].Trim(), $parts[1].Trim(), "Process")
    }
  }
}

$resourceGroup = $env:RESOURCE_GROUP
if (-not $resourceGroup) { $resourceGroup = "rg-jojira-dev" }

$location = $env:LOCATION
if (-not $location) { $location = "eastus" }

$acrName = $env:ACR_NAME
if (-not $acrName) { $acrName = "crjojiradev" }

$imageName = $env:IMAGE_NAME
if (-not $imageName) { $imageName = "jojira-ui" }

$imageTag = $env:IMAGE_TAG
if (-not $imageTag) { $imageTag = "dev-latest" }

$projectRoot = Split-Path -Parent (Split-Path -Parent $PSScriptRoot)

Write-Host "📁 Project Workspace Root: $projectRoot" -ForegroundColor Gray

# 2. Ensure Resource Group & ACR exist
$rgCheck = az group exists --name $resourceGroup 2>$null
if ($rgCheck -ne "true") {
  Write-Host "🔨 Creating Resource Group '$resourceGroup' in $location..." -ForegroundColor Yellow
  az group create --name $resourceGroup --location $location | Out-Null
}

$acrCheck = az acr show --name $acrName --resource-group $resourceGroup 2>$null
if (-not $acrCheck) {
  Write-Host "📦 Creating Azure Container Registry '$acrName'..." -ForegroundColor Yellow
  az acr create --name $acrName --resource-group $resourceGroup --sku Basic --admin-enabled true | Out-Null
}

# 3. Build Docker container image directly in Azure Container Registry (ACR)
Write-Host "🐳 Building container image '$acrName.azurecr.io/${imageName}:${imageTag}' using ACR Build..." -ForegroundColor Green
az acr build `
  --registry $acrName `
  --image "${imageName}:${imageTag}" `
  --file "$projectRoot\deploy\container_apps\Dockerfile.prod" `
  "$projectRoot"

# 4. Execute Container App Deployment Script
$deployScript = "$PSScriptRoot\deploy_container_app_dev.ps1"
if (Test-Path $deployScript) {
  & $deployScript `
    -EnvFile $EnvFile `
    -GoogleClientId $GoogleClientId `
    -GoogleClientSecret $GoogleClientSecret `
    -GoogleMapsApiKey $GoogleMapsApiKey
} else {
  Write-Error "Deployment script '$deployScript' not found."
}
