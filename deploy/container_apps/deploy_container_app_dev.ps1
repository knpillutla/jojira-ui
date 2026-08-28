<#
.SYNOPSIS
  Deploy jojira-ui Azure Container App with Azure Key Vault Secrets Integration.
#>

param(
  [string]$EnvFile = "$PSScriptRoot\envs\dev.env",
  [string]$GoogleClientId = "",
  [string]$GoogleClientSecret = "",
  [string]$GoogleMapsApiKey = ""
)

$ErrorActionPreference = "Stop"

if (Test-Path $EnvFile) {
  Write-Host "📄 [DEPLOY] Loading environment parameters from $EnvFile..." -ForegroundColor Cipher
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

$containerAppName = $env:CONTAINER_APP_NAME
if (-not $containerAppName) { $containerAppName = "ca-jojira-ui-dev" }

$containerAppEnv = $env:CONTAINER_APP_ENV
if (-not $containerAppEnv) { $containerAppEnv = "cae-jojira-dev" }

$acrName = $env:ACR_NAME
if (-not $acrName) { $acrName = "crjojiradev" }

$keyVaultName = $env:KEY_VAULT_NAME
if (-not $keyVaultName) { $keyVaultName = "kv-jojiradev" }

$imageName = $env:IMAGE_NAME
if (-not $imageName) { $imageName = "jojira-ui" }

$imageTag = $env:IMAGE_TAG
if (-not $imageTag) { $imageTag = "dev-latest" }

$fullImage = "$acrName.azurecr.io/${imageName}:${imageTag}"

Write-Host "🚀 [DEPLOY] Starting Azure Container App Deployment for $containerAppName..." -ForegroundColor Green
Write-Host "📍 Resource Group: $resourceGroup | Location: $location" -ForegroundColor Cyan
Write-Host "🔐 Key Vault Name: $keyVaultName | ACR: $acrName" -ForegroundColor Cyan

# 1. Ensure Resource Group exists
$rgCheck = az group exists --name $resourceGroup 2>$null
if ($rgCheck -ne "true") {
  Write-Host "🔨 [AZURE] Creating Resource Group '$resourceGroup' in $location..." -ForegroundColor Yellow
  az group create --name $resourceGroup --location $location | Out-Null
}

# 2. Ensure Key Vault exists
$kvCheck = az keyvault show --name $keyVaultName --resource-group $resourceGroup 2>$null
if (-not $kvCheck) {
  Write-Host "🔐 [KEY VAULT] Creating Azure Key Vault '$keyVaultName'..." -ForegroundColor Yellow
  az keyvault create --name $keyVaultName --resource-group $resourceGroup --location $location --enable-rbac-authorization true | Out-Null
}

# 3. Save / Update Key Vault Secrets if provided
if ($GoogleClientId) {
  Write-Host "🔑 [KEY VAULT] Storing secret 'google-client-id' in Azure Key Vault..." -ForegroundColor Yellow
  az keyvault secret set --vault-name $keyVaultName --name "google-client-id" --value $GoogleClientId | Out-Null
}

if ($GoogleClientSecret) {
  Write-Host "🔑 [KEY VAULT] Storing secret 'google-client-secret' in Azure Key Vault..." -ForegroundColor Yellow
  az keyvault secret set --vault-name $keyVaultName --name "google-client-secret" --value $GoogleClientSecret | Out-Null
}

if ($GoogleMapsApiKey) {
  Write-Host "🔑 [KEY VAULT] Storing secret 'google-maps-api-key' in Azure Key Vault..." -ForegroundColor Yellow
  az keyvault secret set --vault-name $keyVaultName --name "google-maps-api-key" --value $GoogleMapsApiKey | Out-Null
}

# 4. Ensure Container App Environment exists
$caeCheck = az containerapp env show --name $containerAppEnv --resource-group $resourceGroup 2>$null
if (-not $caeCheck) {
  Write-Host "🏗️ [CONTAINER APP ENV] Creating environment '$containerAppEnv'..." -ForegroundColor Yellow
  az containerapp env create --name $containerAppEnv --resource-group $resourceGroup --location $location | Out-Null
}

# 5. Retrieve Key Vault Secret URLs for Key Vault references
$clientIdSecretUrl = (az keyvault secret show --vault-name $keyVaultName --name "google-client-id" --query "id" -o tsv 2>$null)
$clientSecretSecretUrl = (az keyvault secret show --vault-name $keyVaultName --name "google-client-secret" --query "id" -o tsv 2>$null)

# 6. Deploy or Update Container App
$caExists = az containerapp show --name $containerAppName --resource-group $resourceGroup 2>$null

if (-not $caExists) {
  Write-Host "📦 [CONTAINER APP] Deploying new Container App '$containerAppName'..." -ForegroundColor Green
  az containerapp create `
    --name $containerAppName `
    --resource-group $resourceGroup `
    --environment $containerAppEnv `
    --image $fullImage `
    --target-port 80 `
    --ingress external `
    --system-assigned | Out-Null
} else {
  Write-Host "🔄 [CONTAINER APP] Updating existing Container App '$containerAppName' with image $fullImage..." -ForegroundColor Green
  az containerapp update `
    --name $containerAppName `
    --resource-group $resourceGroup `
    --image $fullImage | Out-Null
}

# 7. Grant Managed Identity permission to Key Vault
$identityPrincipalId = (az containerapp identity show --name $containerAppName --resource-group $resourceGroup --query "principalId" -o tsv 2>$null)
$kvResourceId = (az keyvault show --name $keyVaultName --resource-group $resourceGroup --query "id" -o tsv 2>$null)

if ($identityPrincipalId -and $kvResourceId) {
  Write-Host "🛡️ [SECURITY] Granting Container App Managed Identity access to Key Vault..." -ForegroundColor Yellow
  az role assignment create `
    --assignee-object-id $identityPrincipalId `
    --role "Key Vault Secrets User" `
    --scope $kvResourceId 2>$null | Out-Null
}

# 8. Configure Key Vault Secret References if secret URLs exist
if ($clientIdSecretUrl) {
  Write-Host "🔗 [SECRETS] Mapping Key Vault secret references to Container App..." -ForegroundColor Yellow
  az containerapp secret set `
    --name $containerAppName `
    --resource-group $resourceGroup `
    --secrets "google-client-id=keyvaultref:$clientIdSecretUrl,identity=system" | Out-Null

  az containerapp env set `
    --name $containerAppName `
    --resource-group $resourceGroup `
    --yaml "properties.template.containers[0].env[0].name=GOOGLE_CLIENT_ID,properties.template.containers[0].env[0].secretRef=google-client-id" 2>$null | Out-Null
}

# 9. Get public Container App FQDN / URL
$appFqdn = (az containerapp show --name $containerAppName --resource-group $resourceGroup --query "properties.configuration.ingress.fqdn" -o tsv)

Write-Host "`n✅ [SUCCESS] Deployment complete for jojira-ui!" -ForegroundColor Green
Write-Host "🌐 Public URL: https://$appFqdn" -ForegroundColor BrightWhite
