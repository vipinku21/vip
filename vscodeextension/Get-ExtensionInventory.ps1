<#
.SYNOPSIS
    Collects installed VS Code Extensions and Notepad++ Plugins and appends delta changes to a CSV file (SharePoint compatible).

.DESCRIPTION
    This script inspects the current user's environment for:
      1. Installed VS Code Extensions (via ~/.vscode/extensions/package.json)
      2. Installed Notepad++ Plugins (via AppData and Program Files plugin directories)
    
    It maintains a CSV inventory file and performs DELTA tracking:
      - Only adds NEW extensions/plugins or UPDATED versions since the last run.
      - Tags each entry with User Name, Host Name, Application, Extension ID/Folder Name, Extension Name/DLL, Version, Status (New/Updated), and Timestamp.

.PARAMETER CsvPath
    Path to the CSV output file. Default: ".\Extension_Inventory.csv"

.PARAMETER ForceFullScan
    If specified, ignores delta check and outputs all currently installed items.

.EXAMPLE
    .\Get-ExtensionInventory.ps1 -CsvPath "C:\SharePointSyncFolder\Extension_Inventory.csv"
#>

[CmdletBinding()]
param(
    [string]$CsvPath = ".\Extension_Inventory.csv",
    [switch]$ForceFullScan
)

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------

function Get-VSCodeExtensions {
    param([string]$Username)

    $vscodePath = Join-Path $env:USERPROFILE ".vscode\extensions"
    $extensions = @()

    if (Test-Path $vscodePath) {
        Get-ChildItem -Path $vscodePath -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $pkgJsonPath = Join-Path $_.FullName "package.json"
            if (Test-Path $pkgJsonPath) {
                try {
                    $json = Get-Content -Path $pkgJsonPath -Raw -ErrorAction Stop | ConvertFrom-Json
                    
                    $publisher = if ($json.publisher) { $json.publisher } else { "Unknown" }
                    $name      = if ($json.name) { $json.name } else { $_.Name }
                    $displayName = if ($json.displayName) { $json.displayName } else { $name }
                    $version   = if ($json.version) { $json.version } else { "Unknown" }
                    $extId     = "$publisher.$name"

                    $extensions += [PSCustomObject]@{
                        ComputerName  = $env:COMPUTERNAME
                        UserName      = $Username
                        Application   = "VS Code"
                        Identifier    = $extId            # Extension ID (e.g. ms-python.python)
                        ItemName      = $displayName      # Extension Name
                        Version       = $version
                        Detail        = "Publisher: $publisher"
                    }
                } catch {
                    # Skip invalid JSON or inaccessible files
                }
            }
        }
    }

    return $extensions
}

function Get-NotepadPlusPlusPlugins {
    param([string]$Username)

    # Notepad++ plugin locations (User AppData, Roaming & System Program Files)
    $pluginPaths = @(
        (Join-Path $env:APPDATA "Notepad++\plugins"),
        (Join-Path $env:LOCALAPPDATA "Notepad++\plugins"),
        (Join-Path $env:ProgramFiles "Notepad++\plugins"),
        (Join-Path ${env:ProgramFiles(x86)} "Notepad++\plugins")
    ) | Where-Object { ! [string]::IsNullOrEmpty($_) -and (Test-Path $_) }

    $plugins = @()
    $processedDlls = [System.Collections.Generic.HashSet[string]]::new()

    foreach ($path in $pluginPaths) {
        Get-ChildItem -Path $path -Directory -ErrorAction SilentlyContinue | ForEach-Object {
            $folderName = $_.Name
            Get-ChildItem -Path $_.FullName -Filter "*.dll" -File -ErrorAction SilentlyContinue | ForEach-Object {
                $dllName = $_.Name
                $uniqueKey = "$folderName|$dllName"

                if (-not $processedDlls.Contains($uniqueKey)) {
                    $null = $processedDlls.Add($uniqueKey)
                    
                    $fileVersion = $_.VersionInfo.FileVersion
                    if ([string]::IsNullOrWhiteSpace($fileVersion)) {
                        $fileVersion = $_.VersionInfo.ProductVersion
                    }
                    if ([string]::IsNullOrWhiteSpace($fileVersion)) {
                        $fileVersion = "N/A"
                    }

                    $plugins += [PSCustomObject]@{
                        ComputerName  = $env:COMPUTERNAME
                        UserName      = $Username
                        Application   = "Notepad++"
                        Identifier    = $folderName       # Folder Name
                        ItemName      = $dllName          # DLL File Name
                        Version       = $fileVersion.Trim()
                        Detail        = "Path: $($_.FullName)"
                    }
                }
            }
        }
    }

    return $plugins
}

# -----------------------------------------------------------------------------
# Main Execution
# -----------------------------------------------------------------------------

$currentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$timestamp   = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " Scanning Extension & Plugin Inventory for User: $currentUser" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Fetch current installed items
$vsCodeExts = Get-VSCodeExtensions -Username $currentUser
$nppPlugins = Get-NotepadPlusPlusPlugins -Username $currentUser

$currentInventory = @($vsCodeExts) + @($nppPlugins)

Write-Host "Found $($vsCodeExts.Count) VS Code extension(s)." -ForegroundColor Green
Write-Host "Found $($nppPlugins.Count) Notepad++ plugin(s)." -ForegroundColor Green

if ($currentInventory.Count -eq 0) {
    Write-Host "No extensions or plugins detected on this system." -ForegroundColor Yellow
    exit 0
}

# 2. Read existing CSV for Delta Comparison
$existingRecords = @()
$resolvedCsvPath = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($CsvPath)

if ((Test-Path $resolvedCsvPath) -and (-not $ForceFullScan)) {
    try {
        $existingRecords = Import-Csv -Path $resolvedCsvPath -ErrorAction Stop
        Write-Host "Loaded $($existingRecords.Count) existing records from CSV for delta comparison." -ForegroundColor Gray
    } catch {
        Write-Warning "Could not read existing CSV file ($resolvedCsvPath). Performing full scan export."
    }
}

# Build hash table of existing items for rapid lookup
# Key: UserName | Application | Identifier | ItemName | Version
$existingKeys = [System.Collections.Generic.HashSet[string]]::new()
foreach ($rec in $existingRecords) {
    $key = "$($rec.UserName)|$($rec.Application)|$($rec.Identifier)|$($rec.ItemName)|$($rec.Version)".ToLower()
    $null = $existingKeys.Add($key)
}

# 3. Filter for DELTA (New or Changed items)
$deltaItems = @()

foreach ($item in $currentInventory) {
    $itemKey = "$($item.UserName)|$($item.Application)|$($item.Identifier)|$($item.ItemName)|$($item.Version)".ToLower()
    
    if (-not $existingKeys.Contains($itemKey) -or $ForceFullScan) {
        $status = if ($existingRecords.Count -eq 0) { "Initial Scan" } else { "New/Updated" }
        
        $deltaItems += [PSCustomObject]@{
            "ScanDate"     = $timestamp
            "UserName"     = $item.UserName
            "ComputerName" = $item.ComputerName
            "Application"  = $item.Application
            "Identifier"   = $item.Identifier    # VSCode: Extension ID | Notepad++: Folder Name
            "ItemName"     = $item.ItemName      # VSCode: Extension Name | Notepad++: DLL File Name
            "Version"      = $item.Version
            "Status"       = $status
            "Detail"       = $item.Detail
        }
    }
}

# 4. Export / Append to CSV
if ($deltaItems.Count -gt 0) {
    Write-Host "`nFound $($deltaItems.Count) NEW or UPDATED item(s) to write to CSV:" -ForegroundColor Green
    $deltaItems | Format-Table -Property Application, Identifier, ItemName, Version, Status -AutoSize

    # Ensure target folder exists
    $csvDirectory = Split-Path -Path $resolvedCsvPath -Parent
    if ($csvDirectory -and (-not (Test-Path $csvDirectory))) {
        New-Item -Path $csvDirectory -ItemType Directory -Force | Out-Null
    }

    # Append to CSV if file exists, otherwise create new
    if (Test-Path $resolvedCsvPath) {
        $deltaItems | Export-Csv -Path $resolvedCsvPath -Append -NoTypeInformation -Encoding UTF8
    } else {
        $deltaItems | Export-Csv -Path $resolvedCsvPath -NoTypeInformation -Encoding UTF8
    }

    Write-Host "Successfully saved delta items to: $resolvedCsvPath" -ForegroundColor Green
} else {
    Write-Host "`nNo changes detected. CSV inventory is up to date!" -ForegroundColor Yellow
}
