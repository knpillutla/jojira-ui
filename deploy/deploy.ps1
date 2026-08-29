# ==============================================================================
# "Build Once, Deploy Anywhere" Azure Container Apps Deployment Script [PowerShell]
# Usage:
#   .\deploy.ps1 -Env dev -Tag v1.0.0              # Deploy pre-built image v1.0.0 to dev
#   .\deploy.ps1 -Env prod -Tag v1.0.0             # Deploy exact same image v1.0.0 to prod
#   .\deploy.ps1 -Env dev -Tag v1.0.0 -Build       # Build image once, then deploy to dev
# ==============================================================================
param (
    [string]$Env = "dev",
    [string]$Tag = "",
    [switch]$Build
)

if ([string]::IsNullOrWhiteSpace($Tag)) {
    $GitSha = git rev-parse --short HEAD 2>$null
    if ($GitSha) {
        $Tag = $GitSha.Trim()
    } else {
        $Tag = "dev-" + (Get-Date -Format "yyyyMMdd-HHmmss")
    }
}

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ContainerAppsDir = Join-Path $ScriptDir "container_apps"
if (Test-Path $ContainerAppsDir) {
    $ScriptDir = $ContainerAppsDir
}
$RootDir = Split-Path -Parent (Split-Path -Parent $ScriptDir)
if (-not (Test-Path (Join-Path $RootDir "Dockerfile"))) {
    $RootDir = Split-Path -Parent $ScriptDir
}

$EnvFile = Join-Path $ScriptDir "envs\$Env.env"

if (Test-Path $EnvFile) {
    Write-Host "[+] Loading environment configuration from '$EnvFile'..." -ForegroundColor Cyan
    Get-Content $EnvFile | ForEach-Object {
        if ($_ -match '^\s*([^#=]+)\s*=\s*"?([^"#]+)"?') {
            [Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim())
        }
    }
} else {
    Write-Error "Configuration file '$EnvFile' not found!"
}

$Subscription = if ($env:AZURE_SUBSCRIPTION_NAME) { $env:AZURE_SUBSCRIPTION_NAME } elseif ($env:AZURE_SUBSCRIPTION_ID) { $env:AZURE_SUBSCRIPTION_ID } else { $env:AZURE_SUBSCRIPTION }
$ResourceGroup = if ($env:AZURE_RESOURCE_GROUP) { $env:AZURE_RESOURCE_GROUP } else { "rg-containerapp-$Env" }
$Location = if ($env:AZURE_LOCATION) { $env:AZURE_LOCATION } else { "East US" }
$ContainerAppEnv = if ($env:AZURE_CONTAINER_APP_ENV) { $env:AZURE_CONTAINER_APP_ENV } else { "cae-jojira-dev-env" }
$AcrName = if ($env:AZURE_ACR_NAME) { $env:AZURE_ACR_NAME } else { "jojiraserverlessacr" }
$AkvName = if ($env:AZURE_KEYVAULT_NAME) { $env:AZURE_KEYVAULT_NAME } else { "jojiradevcakv" }

$UiAppName = if ($env:CONTAINER_APP_UI_NAME) { $env:CONTAINER_APP_UI_NAME } else { "app-jojira-ui-$Env" }
$ApiAppName = if ($env:CONTAINER_APP_API_NAME) { $env:CONTAINER_APP_API_NAME } else { "app-jojira-$Env" }
$UserSvcAppName = if ($env:CONTAINER_APP_USER_SERVICE_NAME) { $env:CONTAINER_APP_USER_SERVICE_NAME } else { "app-jojira-user-service-$Env" }

$ApiAppHost = if ($env:CONTAINER_APP_API_HOST) { $env:CONTAINER_APP_API_HOST } else { "app-jojira-dev.mangoglacier-a04733de.eastus.azurecontainerapps.io" }
$UserSvcAppHost = if ($env:CONTAINER_APP_USER_SERVICE_HOST) { $env:CONTAINER_APP_USER_SERVICE_HOST } else { "app-jojira-user-service-dev.mangoglacier-a04733de.eastus.azurecontainerapps.io" }

$AcrServer = "$AcrName.azurecr.io"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host " Starting Azure Container Apps Deployment (jojira-ui)" -ForegroundColor Cyan
Write-Host " Target Environment: $Env" -ForegroundColor Cyan
Write-Host " Subscription:       $Subscription" -ForegroundColor Cyan
Write-Host " Image Tag:          $Tag" -ForegroundColor Cyan
Write-Host " ACR Server:         $AcrServer" -ForegroundColor Cyan
Write-Host " Key Vault (AKV):    $AkvName" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

# 1. Authenticate with Azure
Write-Host "[1/5] Authenticating with Azure CLI..." -ForegroundColor Yellow
if ($Subscription) { az account set --subscription $Subscription }
az extension add --name containerapp --upgrade --yes --allow-preview true

# 2. Build & Push Stage (Only if -Build parameter is specified)
if ($Build) {
    Write-Host "[2/5] [-Build parameter set] Building & Pushing Docker image for jojira-ui..." -ForegroundColor Yellow
    az acr login --name $AcrName

    $dockerfilePath = Join-Path $ScriptDir "Dockerfile.prod"
    if (-not (Test-Path $dockerfilePath)) {
        $dockerfilePath = Join-Path $RootDir "Dockerfile"
    }

    Write-Host "      Building UI image ($AcrServer/jojira-ui:$Tag)..." -ForegroundColor Yellow
    docker build -t "$AcrServer/jojira-ui:$Tag" -f $dockerfilePath "$RootDir"
    docker push "$AcrServer/jojira-ui:$Tag"
} else {
    Write-Host "[2/5] Skipping build step. Reusing pre-built image artifacts..." -ForegroundColor Yellow
}

# 3. Ensure Environment Exists
Write-Host "[3/5] Ensuring Resource Group & Container Apps Environment in '$Env'..." -ForegroundColor Yellow
az group create --name $ResourceGroup --location $Location -o table

$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "Continue"
$EnvCheck = az containerapp env show --name $ContainerAppEnv --resource-group $ResourceGroup 2>$null
if (-not $EnvCheck) {
    az containerapp env create --name $ContainerAppEnv --resource-group $ResourceGroup --location $Location
}

$KvCheck = az keyvault show --name $AkvName --resource-group $ResourceGroup 2>$null
if (-not $KvCheck) {
    az keyvault create --name $AkvName --resource-group $ResourceGroup --location $Location --enable-rbac-authorization true
}

az acr update --name $AcrName --admin-enabled true
$AcrPasswordRaw = az acr credential show --name $AcrName --query "passwords[0].value" -o tsv
$AcrPassword = if ($AcrPasswordRaw) { $AcrPasswordRaw.Trim() } else { "" }
$ErrorActionPreference = $PrevEap

if ([string]::IsNullOrWhiteSpace($AcrPassword)) {
    Write-Error "Failed to fetch ACR password for '$AcrName'. Ensure Azure CLI is authenticated."
}

$Cpu = if ($env:CPU) { $env:CPU } else { "0.25" }
$Memory = if ($env:MEMORY) { $env:MEMORY } else { "0.5Gi" }
$MinReplicas = if ($env:MIN_REPLICAS) { $env:MIN_REPLICAS } else { "0" }
$MaxReplicas = if ($env:MAX_REPLICAS) { $env:MAX_REPLICAS } else { "10" }

# 4. Deploy UI Container App
Write-Host "[4/5] Deploying / Updating '$UiAppName' with environment configs..." -ForegroundColor Yellow
$PrevEap = $ErrorActionPreference
$ErrorActionPreference = "SilentlyContinue"

$caExists = az containerapp show --name $UiAppName --resource-group $ResourceGroup --only-show-errors 2>$null

if (-not $caExists) {
    az containerapp create `
        --name $UiAppName `
        --resource-group $ResourceGroup `
        --environment $ContainerAppEnv `
        --image "$AcrServer/jojira-ui:$Tag" `
        --registry-server $AcrServer `
        --registry-username $AcrName `
        --registry-password $AcrPassword `
        --target-port 80 `
        --ingress external `
        --cpu $Cpu `
        --memory $Memory `
        --min-replicas $MinReplicas `
        --max-replicas $MaxReplicas `
        --env-vars `
        ENVIRONMENT="$Env" `
        AZURE_KEYVAULT_ENABLED="true" `
        AZURE_KEYVAULT_NAME="$AkvName" `
        AZURE_KEYVAULT_URL="https://$AkvName.vault.azure.net/" `
        CONTAINER_APP_USER_SERVICE_HOST="$UserSvcAppHost" `
        CONTAINER_APP_API_HOST="$ApiAppHost" `
        --system-assigned --only-show-errors *>$null
} else {
    az containerapp update `
        --name $UiAppName `
        --resource-group $ResourceGroup `
        --image "$AcrServer/jojira-ui:$Tag" `
        --set-env-vars `
        ENVIRONMENT="$Env" `
        AZURE_KEYVAULT_ENABLED="true" `
        AZURE_KEYVAULT_NAME="$AkvName" `
        AZURE_KEYVAULT_URL="https://$AkvName.vault.azure.net/" `
        CONTAINER_APP_USER_SERVICE_HOST="$UserSvcAppHost" `
        CONTAINER_APP_API_HOST="$ApiAppHost" --only-show-errors *>$null
}
$ErrorActionPreference = $PrevEap

# 5. Retrieve Key Vault Secret references & Role assignment
Write-Host "[5/5] Configuring Key Vault Secret References and Identity Permissions..." -ForegroundColor Yellow
$identityPrincipalId = az containerapp identity show --name $UiAppName --resource-group $ResourceGroup --query "principalId" -o tsv 2>$null
$kvResourceId = az keyvault show --name $AkvName --resource-group $ResourceGroup --query "id" -o tsv 2>$null

if ($identityPrincipalId -and $kvResourceId) {
    $OldEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    az role assignment create --assignee-object-id $identityPrincipalId --assignee-principal-type ServicePrincipal --role "Key Vault Secrets User" --scope $kvResourceId --only-show-errors *>$null
    $ErrorActionPreference = $OldEap
}

$UiUrl = az containerapp show --name $UiAppName --resource-group $ResourceGroup --query "properties.configuration.ingress.fqdn" -o tsv

Write-Host "==================================================================" -ForegroundColor Green
Write-Host " [SUCCESS] Deployed image '$Tag' to '$Env' environment!" -ForegroundColor Green
Write-Host " UI Web Application URL: https://$UiUrl" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Green
