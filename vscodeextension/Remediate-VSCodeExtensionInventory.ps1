<#
.SYNOPSIS
    Intune Remediation Script - VS Code Extension Inventory
    
.DESCRIPTION
    Runs under SYSTEM context via Intune.
    1. Scans ALL user profiles on the machine for installed VS Code extensions.
    2. Extracts: User Name, Extension ID, Extension Name, Version, Computer Name, Scan Date.
    3. Transmits data to SharePoint via an Azure Function HTTP Webhook (Zero authentication required on endpoint machines).
    
    Intune Exit Codes:
      Exit 0 = Remediation Successful (Data fetched and pushed to SharePoint)
      Exit 1 = Remediation Failed (Endpoint error or unreachable Webhook)
#>

[CmdletBinding()]
param(
    # The Azure Function Webhook URL (Acts as Auth Proxy to SharePoint - NO endpoint login required!)
    [string]$AzureFunctionUrl = "https://your-function-app.azurewebsites.net/api/SyncVSCodeInventory?code=YOUR_WEBHOOK_KEY",

    # Alternative: Direct Synced/Network SharePoint Path (If using local sync mode instead of Webhook)
    [string]$SharePointSyncedPath = ""
)

# -----------------------------------------------------------------------------
# STEP 1: Scan ALL User Profiles on Machine for VS Code Extensions
# -----------------------------------------------------------------------------
function Get-SystemUserProfiles {
    $profiles = @()

    # Query Windows Registry for active user profiles (excludes system accounts)
    $profileListPath = "HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList"
    if (Test-Path $profileListPath) {
        Get-ChildItem -Path $profileListPath -ErrorAction SilentlyContinue | ForEach-Object {
            $itemProp = Get-ItemProperty -Path $_.PSPath -ErrorAction SilentlyContinue
            if ($itemProp -and $itemProp.ProfileImagePath) {
                $imgPath = $itemProp.ProfileImagePath
                if (Test-Path $imgPath -ErrorAction SilentlyContinue) {
                    $leafName = Split-Path -Path $imgPath -Leaf
                    if ($leafName -notmatch '^(systemprofile|LocalService|NetworkService|Public|Default|Default User)$') {
                        $profiles += [PSCustomObject]@{
                            UserName    = $leafName
                            ProfilePath = $imgPath
                        }
                    }
                }
            }
        }
    }

    # Fallback directory scan C:\Users
    if ($profiles.Count -eq 0) {
        Get-ChildItem -Path "C:\Users" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            if ($_.Name -notmatch '^(Public|Default|Default User|All Users|desktop\.ini)$') {
                $profiles += [PSCustomObject]@{
                    UserName    = $_.Name
                    ProfilePath = $_.FullName
                }
            }
        }
    }

    return ($profiles | Group-Object ProfilePath | ForEach-Object { $_.Group[0] })
}

function Get-AllUsersVSCodeExtensions {
    $userProfiles = Get-SystemUserProfiles
    $allExtensions = @()

    foreach ($user in $userProfiles) {
        $vscodePath = Join-Path $user.ProfilePath ".vscode\extensions"

        if (Test-Path $vscodePath) {
            Get-ChildItem -Path $vscodePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                $pkgJsonPath = Join-Path $_.FullName "package.json"
                if (Test-Path $pkgJsonPath) {
                    try {
                        $json = Get-Content -Path $pkgJsonPath -Raw -ErrorAction Stop | ConvertFrom-Json
                        
                        $publisher   = if ($json.publisher) { $json.publisher } else { "Unknown" }
                        $name        = if ($json.name) { $json.name } else { $_.Name }
                        $displayName = if ($json.displayName) { $json.displayName } else { $name }
                        $version     = if ($json.version) { $json.version } else { "Unknown" }
                        $extId       = "$publisher.$name"

                        $allExtensions += [PSCustomObject]@{
                            userName      = $user.UserName
                            extensionId   = $extId            # e.g., ms-python.python
                            extensionName = $displayName      # e.g., Python
                            version       = $version          # e.g., 2026.4.0
                            publisher     = $publisher
                        }
                    } catch {
                        # Skip invalid JSON files
                    }
                }
            }
        }
    }

    return $allExtensions
}

# -----------------------------------------------------------------------------
# STEP 2: Main Remediation Execution
# -----------------------------------------------------------------------------

$timestamp    = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$computerName = $env:COMPUTERNAME

Write-Output "=========================================================="
Write-Output " Executing VS Code Extension Inventory Remediation"
Write-Output " Computer: $computerName | Timestamp: $timestamp"
Write-Output "=========================================================="

# 1. Fetch all VS Code extensions across all users
$extensionData = Get-AllUsersVSCodeExtensions

Write-Output "Scan complete. Found $($extensionData.Count) extension(s) installed across all users on $computerName."

if ($extensionData.Count -eq 0) {
    Write-Output "No VS Code extensions detected on this computer. Exiting (0)."
    exit 0
}

# 2. Transmit Data to SharePoint

# METHOD A: Azure Function Webhook (No endpoint authentication required!)
if (-not [string]::IsNullOrWhiteSpace($AzureFunctionUrl) -and $AzureFunctionUrl -notlike "*YOUR_WEBHOOK_KEY*") {
    
    $payload = [PSCustomObject]@{
        computerName = $computerName
        scanDate     = $timestamp
        extensions   = $extensionData
    }

    $jsonBody = $payload | ConvertTo-Json -Depth 5

    try {
        Write-Output "Posting extension inventory payload to Azure Function Webhook URL..."
        
        # Enforce TLS 1.2
        [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
        
        $response = Invoke-RestMethod -Uri $AzureFunctionUrl -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop

        Write-Output "SUCCESS: Extension inventory data successfully received and pushed to SharePoint!"
        Write-Output "Server Response: $($response | ConvertTo-Json -Compress)"
        
        # Save local cache marker
        $cacheDirectory = Join-Path $env:ProgramData "CompanyVSCodeInventory"
        if (-not (Test-Path $cacheDirectory)) { New-Item -Path $cacheDirectory -ItemType Directory -Force | Out-Null }
        $extensionData | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $cacheDirectory "LocalInventoryCache.json") -Force

        exit 0
    } catch {
        Write-Error "ERROR: Failed to transmit data to Azure Function Webhook. Exception: $($_.Exception.Message)"
        exit 1
    }
}
# METHOD B: Local Synced / Network SharePoint Folder (Fallback)
elseif (-not [string]::IsNullOrWhiteSpace($SharePointSyncedPath) -and (Test-Path $SharePointSyncedPath)) {
    
    $targetCsvPath = Join-Path $SharePointSyncedPath "VSCode_Extension_Inventory.csv"

    # Read existing for delta append
    $existingRecords = @()
    if (Test-Path $targetCsvPath) {
        try { $existingRecords = Import-Csv -Path $targetCsvPath -ErrorAction SilentlyContinue } catch {}
    }

    $existingKeys = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($rec in $existingRecords) {
        $key = "$($rec.ComputerName)|$($rec.UserName)|$($rec.ExtensionID)|$($rec.Version)".ToLower()
        $null = $existingKeys.Add($key)
    }

    $deltaItems = @()
    foreach ($ext in $extensionData) {
        $itemKey = "$computerName|$($ext.userName)|$($ext.extensionId)|$($ext.version)".ToLower()
        if (-not $existingKeys.Contains($itemKey)) {
            $status = if ($existingRecords.Count -eq 0) { "Initial Scan" } else { "New/Updated" }
            $deltaItems += [PSCustomObject]@{
                "ScanDate"      = $timestamp
                "ComputerName"  = $computerName
                "UserName"      = $ext.userName
                "ExtensionID"   = $ext.extensionId
                "ExtensionName" = $ext.extensionName
                "Version"       = $ext.version
                "Status"        = $status
                "Publisher"     = $ext.publisher
            }
        }
    }

    if ($deltaItems.Count -gt 0) {
        if (Test-Path $targetCsvPath) {
            $deltaItems | Export-Csv -Path $targetCsvPath -Append -NoTypeInformation -Encoding UTF8
        } else {
            $deltaItems | Export-Csv -Path $targetCsvPath -NoTypeInformation -Encoding UTF8
        }
        Write-Output "SUCCESS: Appended $($deltaItems.Count) new extension record(s) to $targetCsvPath"
    } else {
        Write-Output "SUCCESS: Inventory is already up to date in $targetCsvPath"
    }

    exit 0
}
else {
    Write-Error "ERROR: Please specify either a valid -AzureFunctionUrl or -SharePointSyncedPath parameter."
    exit 1
}
