# VS Code Extension Inventory System: Master Enterprise Guide

This document serves as the complete technical specification, source code repository, architecture reference, and deployment guide for the **VS Code Extension Inventory Collection System** built for **Microsoft Intune (200+ Endpoints)**, **Azure Function Webhooks**, and **SharePoint Online**.

---

## 📋 Table of Contents
1. [Executive Summary & Architecture](#1-executive-summary--architecture)
2. [Component File Directory](#2-component-file-directory)
3. [How Webhook Ingestion Works](#3-how-webhook-ingestion-works)
4. [Line-by-Line SharePoint Insertion Logic](#4-line-by-line-sharepoint-insertion-logic)
5. [How to Change the SharePoint Location](#5-how-to-change-the-sharepoint-location)
6. [Complete Source Code Files](#6-complete-source-code-files)
7. [Step-by-Step Intune & Azure Deployment Guide](#7-step-by-step-intune--azure-deployment-guide)
8. [Data Schema / Reporting Columns](#8-data-schema--reporting-columns)

---

## 1. Executive Summary & Architecture

This solution provides automated, zero-touch visibility into installed VS Code extensions across **all user profiles** on 200+ enterprise Windows endpoints managed by Microsoft Intune.

```
┌────────────────────────────────────────────────────────────────────────┐
│               INTUNE ENDPOINT DEVICE (SYSTEM CONTEXT)                  │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 1. Detection Script (Detect-VSCodeExtensionInventory.ps1)        │  │
│  │    Checks local extensions in C:\Users\* against local cache.    │  │
│  │    Exit 0 = Compliant | Exit 1 = Non-Compliant (Remediate)       │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
│                                    │                                   │
│                                    ▼                                   │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ 2. Remediation Script (Remediate-VSCodeExtensionInventory.ps1)   │  │
│  │    Fetches: UserName, ExtensionID, Name, Version, ComputerName   │  │
│  │    Transmits JSON Payload via HTTPS POST to Webhook URL          │  │
│  └─────────────────────────────────┬────────────────────────────────┘  │
└────────────────────────────────────┼───────────────────────────────────┘
                                     │
                                     │ HTTPS TLS 1.2 Webhook Request
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                   AZURE FUNCTION HTTP WEBHOOK (CLOUD)                  │
│                                                                        │
│  - Receives JSON payload without requiring endpoint credentials        │
│  - Connects to SharePoint Online using Azure Managed Identity          │
│  - Computes Delta matching (prevents duplicate rows)                   │
└────────────────────────────────────┬───────────────────────────────────┘
                                     │
                                     ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        SHAREPOINT ONLINE LOCATION                      │
│                                                                        │
│  Mode A: SharePoint List (Add-PnPListItem) -> Power BI / Web View      │
│  Mode B: Document Library (Add-PnPFile)   -> Central CSV File          │
└────────────────────────────────────────────────────────────────────────┘
```

### Key Highlights:
- **SYSTEM Context Ready**: Iterates through `HKLM ProfileList` and `C:\Users\*` to find extensions installed by all users on shared/multi-user PCs.
- **Zero Endpoint Authentication**: Endpoints send data to an Azure Function Webhook URL over HTTPS TLS 1.2. No passwords, client secrets, or certificates are stored on local PCs.
- **Concurrency & Delta Control**: Handled server-side by the Azure Function, preventing CSV file locking issues across 200+ endpoints.

---

## 2. Component File Directory

All scripts and documentation files are available locally in the workspace:

| File Name | Description | Link |
| :--- | :--- | :--- |
| **`Detect-VSCodeExtensionInventory.ps1`** | Intune Detection Script. Scans all user profiles and checks if local inventory has unsynced changes. | [View File](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Detect-VSCodeExtensionInventory.ps1) |
| **`Remediate-VSCodeExtensionInventory.ps1`** | Intune Remediation Script. Does all scanning work on endpoint and posts JSON payload to Azure Function URL. | [View File](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Remediate-VSCodeExtensionInventory.ps1) |
| **`AzureFunction_SyncVSCodeInventory.ps1`** | Backend Azure Function code (PowerShell runtime). Validates incoming payloads and appends delta data to SharePoint. | [View File](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/AzureFunction_SyncVSCodeInventory.ps1) |
| **`README.md`** | Overview & quick-start instructions. | [View File](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/README.md) |

---

## 3. How Webhook Ingestion Works

A **Webhook** is an HTTPS endpoint hosted in Azure that listens for data submitted by endpoints.

### Step 1: Endpoint Constructs JSON Payload
The Remediation script on the endpoint packages all scanned extensions into a structured JSON string:
```json
{
  "computerName": "DESKTOP-FINANCE01",
  "scanDate": "2026-08-05 12:30:00",
  "extensions": [
    {
      "userName": "johndoe",
      "extensionId": "ms-python.python",
      "extensionName": "Python",
      "version": "2026.4.0",
      "publisher": "ms-python"
    },
    {
      "userName": "johndoe",
      "extensionId": "eamodio.gitlens",
      "extensionName": "GitLens",
      "version": "15.0.1",
      "publisher": "eamodio"
    }
  ]
}
```

### Step 2: Endpoint Sends Payload to Webhook URL
```powershell
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Invoke-RestMethod -Uri "https://my-func.azurewebsites.net/api/SyncVSCodeInventory?code=WEBHOOK_KEY" `
    -Method Post -Body $jsonBody -ContentType "application/json"
```

### Step 3: Azure Function Processes & Returns Response
The Azure Function receives the JSON payload, connects to SharePoint using Azure Managed Identity, appends delta records, and returns HTTP 200 OK:
```json
{
  "status": "Success",
  "destination": "SharePoint List (VSCodeExtensionInventory)",
  "computerName": "DESKTOP-FINANCE01",
  "newItemsAdded": 2,
  "message": "Successfully inserted 2 new extension record(s) into SharePoint List."
}
```

---

## 4. Line-by-Line SharePoint Insertion Logic

The Azure Function script (`AzureFunction_SyncVSCodeInventory.ps1`) supports **two SharePoint insertion modes**:

### METHOD A: Inserting Data into a SharePoint List (`Add-PnPListItem`)
```powershell
# 1. Connect to SharePoint Online via PnP PowerShell
Connect-PnPOnline -Url "https://yourcompany.sharepoint.com/sites/ITInventory" -ManagedIdentity

# 2. Get existing items to perform Delta check (prevents duplicate rows)
$existingItems = Get-PnPListItem -List "VSCodeExtensionInventory" -Fields "ComputerName", "UserName", "ExtensionID", "ExtensionVersion"

$existingKeys = [System.Collections.Generic.HashSet[string]]::new()
foreach ($item in $existingItems) {
    $key = "$($item['ComputerName'])|$($item['UserName'])|$($item['ExtensionID'])|$($item['ExtensionVersion'])".ToLower()
    $null = $existingKeys.Add($key)
}

# 3. Add new extension records to SharePoint List
foreach ($ext in $extensions) {
    $itemKey = "$computerName|$($ext.userName)|$($ext.extensionId)|$($ext.version)".ToLower()

    if (-not $existingKeys.Contains($itemKey)) {
        Add-PnPListItem -List "VSCodeExtensionInventory" -Values @{
            "Title"            = "$computerName - $($ext.extensionId)"
            "ComputerName"     = $computerName
            "UserName"         = $ext.userName
            "ExtensionID"      = $ext.extensionId
            "ExtensionName"    = $ext.extensionName
            "ExtensionVersion" = $ext.version
            "ScanDate"         = $scanDate
        }
    }
}
```

### METHOD B: Inserting Data into a SharePoint CSV File (`Add-PnPFile`)
```powershell
# 1. Download existing CSV file from SharePoint Document Library
Get-PnPFile -Url "/sites/ITInventory/Shared Documents/VSCode_Extension_Inventory.csv" -Path $tempPath -Filename "VSCode_Extension_Inventory.csv" -AsFile -Force

# 2. Append new delta extension rows to local CSV file
if (Test-Path $localCsvPath) {
    $deltaItems | Export-Csv -Path $localCsvPath -Append -NoTypeInformation -Encoding UTF8
} else {
    $deltaItems | Export-Csv -Path $localCsvPath -NoTypeInformation -Encoding UTF8
}

# 3. Upload updated CSV file back to SharePoint Document Library
Add-PnPFile -Path $localCsvPath -Folder "Shared Documents" -Values @{Title="VS Code Extension Inventory"}
```

---

## 5. How to Change the SharePoint Location

Because endpoints submit data to the Azure Function Webhook, **you do NOT need to touch or redeploy code on any of the 200+ user machines to change the SharePoint location.**

### Changing Location via Azure Portal (Zero Endpoint Changes)
1. Go to **Azure Portal** (`https://portal.azure.com`) -> **Function Apps** -> Select your Function App.
2. Under **Settings**, click **Environment variables** (or **Configuration**).
3. Update the following environment variable keys:

| Environment Variable | Description | Example Value |
| :--- | :--- | :--- |
| `SharePointSiteUrl` | Target SharePoint Site URL | `https://yourcompany.sharepoint.com/sites/NewSite` |
| `DestinationMode` | Choose output type | `SharePointList` or `SharePointCsv` |
| `ListName` | Target SharePoint List Name | `VSCodeExtensionInventory` |
| `LibraryName` | Target Document Library Name | `Shared Documents` |
| `CsvFileName` | Target CSV File Name | `VSCode_Extension_Inventory.csv` |

4. Click **Apply** and **Save**. All 200+ Intune endpoints will automatically write to the new location on their next daily execution!

---

## 6. Complete Source Code Files

### 6.1 Intune Detection Script (`Detect-VSCodeExtensionInventory.ps1`)

```powershell
<#
.SYNOPSIS
    Intune Proactive Remediation - DETECTION SCRIPT
    Scans all user profiles for installed VS Code extensions and checks if local inventory has unsynced changes.
    
    Intune Exit Codes:
      Exit 0 = Compliant (Inventory is up to date; Remediation will NOT run)
      Exit 1 = Non-Compliant (Unsynced extensions or missing cache; Remediation WILL run)
#>

$cacheDirectory = Join-Path $env:ProgramData "CompanyVSCodeInventory"
$cacheFile      = Join-Path $cacheDirectory "LocalInventoryCache.json"

function Get-SystemUserProfiles {
    $profiles = @()

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

function Get-CurrentVSCodeState {
    $userProfiles = Get-SystemUserProfiles
    $currentState = @()

    foreach ($user in $userProfiles) {
        $vscodePath = Join-Path $user.ProfilePath ".vscode\extensions"

        if (Test-Path $vscodePath) {
            Get-ChildItem -Path $vscodePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
                $pkgJsonPath = Join-Path $_.FullName "package.json"
                if (Test-Path $pkgJsonPath) {
                    try {
                        $json = Get-Content -Path $pkgJsonPath -Raw -ErrorAction Stop | ConvertFrom-Json
                        $publisher = if ($json.publisher) { $json.publisher } else { "Unknown" }
                        $name      = if ($json.name) { $json.name } else { $_.Name }
                        $version   = if ($json.version) { $json.version } else { "Unknown" }
                        $extId     = "$publisher.$name"

                        $currentState += [PSCustomObject]@{
                            ComputerName = $env:COMPUTERNAME
                            UserName     = $user.UserName
                            ExtensionID  = $extId
                            Version      = $version
                        }
                    } catch {}
                }
            }
        }
    }

    return $currentState
}

try {
    $currentExtensions = Get-CurrentVSCodeState

    if ($currentExtensions.Count -eq 0) {
        Write-Output "Compliant: No VS Code extensions found on system."
        exit 0
    }

    if (-not (Test-Path $cacheFile)) {
        Write-Output "Non-Compliant: Local inventory cache missing. Triggering Remediation."
        exit 1
    }

    $cachedData = Get-Content -Path $cacheFile -Raw -ErrorAction Stop | ConvertFrom-Json
    
    $cachedHashSet = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($item in $cachedData) {
        $key = "$($item.UserName)|$($item.ExtensionID)|$($item.Version)".ToLower()
        $null = $cachedHashSet.Add($key)
    }

    $hasUnsyncedChanges = $false
    foreach ($current in $currentExtensions) {
        $currentKey = "$($current.UserName)|$($current.ExtensionID)|$($current.Version)".ToLower()
        if (-not $cachedHashSet.Contains($currentKey)) {
            $hasUnsyncedChanges = $true
            break
        }
    }

    if ($hasUnsyncedChanges) {
        Write-Output "Non-Compliant: New or updated VS Code extension(s) detected. Triggering Remediation."
        exit 1
    } else {
        Write-Output "Compliant: VS Code extension inventory is up to date."
        exit 0
    }
} catch {
    Write-Output "Non-Compliant: Detection check encountered error ($($_.Exception.Message)). Triggering Remediation."
    exit 1
}
```

---

### 6.2 Intune Remediation Script (`Remediate-VSCodeExtensionInventory.ps1`)

```powershell
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
    [string]$AzureFunctionUrl = "https://your-function-app.azurewebsites.net/api/SyncVSCodeInventory?code=YOUR_WEBHOOK_KEY"
)

function Get-SystemUserProfiles {
    $profiles = @()

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
                    } catch {}
                }
            }
        }
    }

    return $allExtensions
}

$timestamp    = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
$computerName = $env:COMPUTERNAME

Write-Output "Executing VS Code Extension Inventory Remediation on $computerName"

# 1. Fetch installed extensions across all users
$extensionData = Get-AllUsersVSCodeExtensions
Write-Output "Found $($extensionData.Count) extension(s) across users on $computerName."

if ($extensionData.Count -eq 0) {
    Write-Output "No VS Code extensions found. Exiting (0)."
    exit 0
}

# 2. Transmit Payload to Azure Function Webhook
$payload = [PSCustomObject]@{
    computerName = $computerName
    scanDate     = $timestamp
    extensions   = $extensionData
}

$jsonBody = $payload | ConvertTo-Json -Depth 5

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $response = Invoke-RestMethod -Uri $AzureFunctionUrl -Method Post -Body $jsonBody -ContentType "application/json" -TimeoutSec 30 -ErrorAction Stop

    Write-Output "SUCCESS: Data received by Azure Function and pushed to SharePoint!"
    
    # Save local cache marker
    $cacheDirectory = Join-Path $env:ProgramData "CompanyVSCodeInventory"
    if (-not (Test-Path $cacheDirectory)) { New-Item -Path $cacheDirectory -ItemType Directory -Force | Out-Null }
    $extensionData | ConvertTo-Json -Depth 3 | Set-Content -Path (Join-Path $cacheDirectory "LocalInventoryCache.json") -Force

    exit 0
} catch {
    Write-Error "ERROR: Failed to post to Azure Function Webhook. Exception: $($_.Exception.Message)"
    exit 1
}
```

---

### 6.3 Azure Function Backend Script (`AzureFunction_SyncVSCodeInventory.ps1`)

```powershell
<#
.SYNOPSIS
    Azure Function (PowerShell HTTP Trigger)
    Receives VS Code Extension Inventory JSON payload from Intune endpoints,
    validates data, performs Delta comparison against SharePoint Online, and inserts records.
#>

using namespace System.Net

param($Request, $TriggerMetadata)

$body = $Request.Body

if (-not $body -or -not $body.computerName -or -not $body.extensions) {
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::BadRequest
        Body       = @{ error = "Invalid payload structure. Required fields: computerName, scanDate, extensions." } | ConvertTo-Json
    })
    return
}

$computerName = $body.computerName
$scanDate     = $body.scanDate
$extensions   = $body.extensions

# Environment Configuration from Azure Function Settings
$siteUrl       = $env:SharePointSiteUrl
$destination   = if ($env:DestinationMode) { $env:DestinationMode } else { "SharePointList" }
$listName      = if ($env:ListName) { $env:ListName } else { "VSCodeExtensionInventory" }
$libName       = if ($env:LibraryName) { $env:LibraryName } else { "Shared Documents" }
$fileName      = if ($env:CsvFileName) { $env:CsvFileName } else { "VSCode_Extension_Inventory.csv" }
$clientId      = $env:ClientId
$tenantId      = $env:TenantId
$secret        = $env:ClientSecret

try {
    if ($clientId -and $secret -and $tenantId) {
        Connect-PnPOnline -Url $siteUrl -ClientId $clientId -ClientSecret $secret -Tenant $tenantId -ErrorAction Stop
    } else {
        Connect-PnPOnline -Url $siteUrl -ManagedIdentity -ErrorAction Stop
    }

    # METHOD A: SHAREPOINT LIST
    if ($destination -eq "SharePointList") {
        $list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
        if (-not $list) {
            $list = New-PnPList -Title $listName -Template GenericList -ErrorAction Stop
            Add-PnPField -List $listName -DisplayName "ComputerName" -InternalName "ComputerName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "UserName" -InternalName "UserName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionID" -InternalName "ExtensionID" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionName" -InternalName "ExtensionName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionVersion" -InternalName "ExtensionVersion" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ScanDate" -InternalName "ScanDate" -Type Text -AddToDefaultView | Out-Null
        }

        $existingItems = Get-PnPListItem -List $listName -PageSize 2000 -Fields "ComputerName", "UserName", "ExtensionID", "ExtensionVersion"
        $existingKeys = [System.Collections.Generic.HashSet[string]]::new()

        foreach ($item in $existingItems) {
            $key = "$($item['ComputerName'])|$($item['UserName'])|$($item['ExtensionID'])|$($item['ExtensionVersion'])".ToLower()
            $null = $existingKeys.Add($key)
        }

        $insertedCount = 0
        foreach ($ext in $extensions) {
            $itemKey = "$computerName|$($ext.userName)|$($ext.extensionId)|$($ext.version)".ToLower()

            if (-not $existingKeys.Contains($itemKey)) {
                Add-PnPListItem -List $listName -Values @{
                    "Title"            = "$computerName - $($ext.extensionId)"
                    "ComputerName"     = $computerName
                    "UserName"         = $ext.userName
                    "ExtensionID"      = $ext.extensionId
                    "ExtensionName"    = $ext.extensionName
                    "ExtensionVersion" = $ext.version
                    "ScanDate"         = $scanDate
                } | Out-Null

                $insertedCount++
            }
        }

        Disconnect-PnPOnline

        Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
            StatusCode = [HttpStatusCode]::OK
            Body       = @{
                status         = "Success"
                destination    = "SharePoint List ($listName)"
                computerName   = $computerName
                newItemsAdded  = $insertedCount
                message        = "Successfully inserted $insertedCount new extension record(s) into SharePoint List."
            } | ConvertTo-Json
        })
        return
    }

    # METHOD B: SHAREPOINT CSV DOCUMENT LIBRARY
    elseif ($destination -eq "SharePointCsv") {
        $tempPath = [System.IO.Path]::GetTempPath()
        $localCsvPath = Join-Path $tempPath $fileName
        $spFileUrl = "/sites/$(Split-Path $siteUrl -Leaf)/$libName/$fileName"
        $existingRecords = @()

        try {
            Get-PnPFile -Url $spFileUrl -Path $tempPath -Filename $fileName -AsFile -Force -ErrorAction SilentlyContinue | Out-Null
            if (Test-Path $localCsvPath) {
                $existingRecords = Import-Csv -Path $localCsvPath
            }
        } catch {}

        $existingKeys = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($rec in $existingRecords) {
            $key = "$($rec.ComputerName)|$($rec.UserName)|$($rec.ExtensionID)|$($rec.Version)".ToLower()
            $null = $existingKeys.Add($key)
        }

        $deltaItems = @()
        foreach ($ext in $extensions) {
            $itemKey = "$computerName|$($ext.userName)|$($ext.extensionId)|$($ext.version)".ToLower()

            if (-not $existingKeys.Contains($itemKey)) {
                $status = if ($existingRecords.Count -eq 0) { "Initial Scan" } else { "New/Updated" }
                $deltaItems += [PSCustomObject]@{
                    "ScanDate"      = $scanDate
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
            if (Test-Path $localCsvPath) {
                $deltaItems | Export-Csv -Path $localCsvPath -Append -NoTypeInformation -Encoding UTF8
            } else {
                $deltaItems | Export-Csv -Path $localCsvPath -NoTypeInformation -Encoding UTF8
            }

            Add-PnPFile -Path $localCsvPath -Folder $libName -Values @{Title="VS Code Extension Inventory"} -ErrorAction Stop | Out-Null
        }

        Disconnect-PnPOnline

        Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
            StatusCode = [HttpStatusCode]::OK
            Body       = @{
                status        = "Success"
                destination   = "SharePoint Library ($libName/$fileName)"
                computerName  = $computerName
                newItemsAdded = $deltaItems.Count
                message       = "Successfully updated $fileName in SharePoint with $($deltaItems.Count) new record(s)."
            } | ConvertTo-Json
        })
        return
    }

} catch {
    Push-OutputBinding -Name Response -Value ([HttpResponseContext]@{
        StatusCode = [HttpStatusCode]::InternalServerError
        Body       = @{ error = "SharePoint Insertion Failed: $($_.Exception.Message)" } | ConvertTo-Json
    })
}
```

---

## 7. Step-by-Step Intune & Azure Deployment Guide

### Phase 1: Deploy Azure Function App
1. Go to Azure Portal -> **Create a Resource** -> **Function App**.
2. Settings:
   - **Runtime stack**: PowerShell Core
   - **Version**: 7.4 or latest
   - **Operating System**: Windows
3. Open the Function App -> **Functions** -> **+ Create** -> **HTTP trigger** named `SyncVSCodeInventory`.
4. Paste [`AzureFunction_SyncVSCodeInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/AzureFunction_SyncVSCodeInventory.ps1) into `run.ps1`.
5. Open **Settings** -> **Environment variables** and configure:
   - `SharePointSiteUrl` = `https://yourcompany.sharepoint.com/sites/ITInventory`
   - `DestinationMode` = `SharePointList`
   - `ListName` = `VSCodeExtensionInventory`
6. Under **Identity**, turn ON **System-Assigned Managed Identity** and assign SharePoint `Sites.ReadWrite.All` permission.
7. Copy the **Function URL with Key** (e.g. `https://myfunc.azurewebsites.net/api/SyncVSCodeInventory?code=XYZ...`).

### Phase 2: Deploy Intune Proactive Remediation Package
1. Open [`Remediate-VSCodeExtensionInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Remediate-VSCodeExtensionInventory.ps1).
2. Paste your Function URL into line 18 (`$AzureFunctionUrl = "https://myfunc.azurewebsites.net/api/SyncVSCodeInventory?code=XYZ..."`).
3. Log into [Microsoft Intune Admin Center](https://intune.microsoft.com).
4. Go to **Devices** -> **Remediations** -> **+ Create script package**.
5. Package Configuration:
   - **Name**: `VS Code Extension Inventory Collection`
   - **Detection script**: `Detect-VSCodeExtensionInventory.ps1`
   - **Remediation script**: `Remediate-VSCodeExtensionInventory.ps1`
   - **Run script using logged-on credentials**: Select **No** (CRITICAL: Runs under SYSTEM context to scan all user profiles).
   - **Run script in 64-bit PowerShell**: Select **Yes**.
6. Assign to your targeted workstation **Device Group** (200+ machines) with a **Daily** schedule.

---

## 8. Data Schema / Reporting Columns

| Column Name | Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `ComputerName` | String | Machine hostname | `DESKTOP-FINANCE01` |
| `UserName` | String | Local/Domain User account | `johndoe` |
| `ExtensionID` | String | Publisher & Extension ID | `ms-python.python` |
| `ExtensionName` | String | Human-readable title | `Python` |
| `ExtensionVersion` | String | Installed extension version | `2026.4.0` |
| `ScanDate` | DateTime | Timestamp when scan occurred | `2026-08-05 12:30:00` |
| `Status` | String | Delta status indicator | `Initial Scan` or `New/Updated` |
