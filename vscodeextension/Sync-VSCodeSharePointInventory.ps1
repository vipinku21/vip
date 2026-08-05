<#
.SYNOPSIS
    System-Context ready script that scans ALL user profiles on a Windows machine for installed VS Code extensions 
    and appends delta changes directly to a Company SharePoint Document Library (CSV/Excel).

.DESCRIPTION
    Designed to run under SYSTEM context (e.g., via Intune, SCCM, or Windows Task Scheduler) or Admin Context:
      - Iterates through ALL user profiles in C:\Users and Windows ProfileList Registry.
      - Extracts: User Name, Extension ID, Extension Name, Version, Computer Name, Publisher, Timestamp.
      - Performs DELTA change detection to prevent duplicates.
      - Uploads results to SharePoint Online via PnP PowerShell (Certificate/App ID/Secret for SYSTEM) 
        or saves to a Shared/Synced SharePoint folder.

.PARAMETER SharePointSiteUrl
    The URL of your company SharePoint site (e.g., "https://contoso.sharepoint.com/sites/ITAssets")

.PARAMETER LibraryName
    The name of the SharePoint Document Library (Default: "Shared Documents")

.PARAMETER CsvFileName
    The file name of the inventory CSV on SharePoint (Default: "VSCode_Extension_Inventory.csv")

.PARAMETER Mode
    "PnPCloud" (Direct SharePoint API Upload via PnP PowerShell) or "LocalSync" (SharePoint Synced Folder / Network Share).

.PARAMETER SyncedFolderPath
    Required if Mode is "LocalSync". Path to the synced SharePoint directory or shared folder.

.PARAMETER ClientId
    Azure AD App Registration Client ID (for headless SYSTEM context PnP connection).

.PARAMETER TenantId
    Azure AD / Entra ID Tenant ID (for headless SYSTEM context PnP connection).

.PARAMETER ClientSecret
    Azure AD App Registration Secret (for headless SYSTEM context PnP connection).

.EXAMPLE
    # Mode 1: Run as SYSTEM using Azure AD App Registration (Headless Cloud Upload)
    .\Sync-VSCodeSharePointInventory.ps1 -SharePointSiteUrl "https://yourcompany.sharepoint.com/sites/ITInventory" `
        -Mode PnPCloud -ClientId "00000000-0000-0000-0000-000000000000" -TenantId "11111111-1111-1111-1111-111111111111" -ClientSecret "YourSecretValue"

.EXAMPLE
    # Mode 2: Run as SYSTEM writing to a Local Synced / Shared Network Path
    .\Sync-VSCodeSharePointInventory.ps1 -Mode LocalSync -SyncedFolderPath "C:\ProgramData\CompanyInventory"
#>

[CmdletBinding()]
param(
    [Parameter(Mandatory = $false)]
    [string]$SharePointSiteUrl = "https://yourcompany.sharepoint.com/sites/ITInventory",

    [Parameter(Mandatory = $false)]
    [string]$LibraryName = "Shared Documents",

    [Parameter(Mandatory = $false)]
    [string]$CsvFileName = "VSCode_Extension_Inventory.csv",

    [Parameter(Mandatory = $false)]
    [ValidateSet("PnPCloud", "LocalSync")]
    [string]$Mode = "LocalSync",

    [Parameter(Mandatory = $false)]
    [string]$SyncedFolderPath = "$env:OneDrive",

    [Parameter(Mandatory = $false)]
    [string]$ClientId,

    [Parameter(Mandatory = $false)]
    [string]$TenantId,

    [Parameter(Mandatory = $false)]
    [string]$ClientSecret
)

# -----------------------------------------------------------------------------
# Function: Get All User Profiles on System
# -----------------------------------------------------------------------------
function Get-SystemUserProfiles {
    $profiles = @()

    # 1. Query HKLM ProfileList (Excludes System Profiles)
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

    # 2. Fallback scan C:\Users
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

    # Remove duplicates
    $uniqueProfiles = $profiles | Group-Object ProfilePath | ForEach-Object { $_.Group[0] }
    return $uniqueProfiles
}

# -----------------------------------------------------------------------------
# Function: Fetch Extensions for ALL Users
# -----------------------------------------------------------------------------
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
                            UserName      = $user.UserName
                            ExtensionID   = $extId            # Extension ID (e.g. ms-python.python)
                            ExtensionName = $displayName      # Extension Name
                            Version       = $version
                            ComputerName  = $env:COMPUTERNAME
                            Publisher     = $publisher
                        }
                    } catch {
                        # Skip invalid JSON or unreadable files
                    }
                }
            }
        }
    }

    return $allExtensions
}

# -----------------------------------------------------------------------------
# Function: Filter Delta Items
# -----------------------------------------------------------------------------
function Get-DeltaInventory {
    param(
        [array]$CurrentInventory,
        [array]$ExistingRecords,
        [string]$ScanTimestamp
    )

    # Key: ComputerName | UserName | ExtensionID | Version
    $existingKeys = [System.Collections.Generic.HashSet[string]]::new()
    foreach ($rec in $ExistingRecords) {
        $key = "$($rec.ComputerName)|$($rec.UserName)|$($rec.ExtensionID)|$($rec.Version)".ToLower()
        $null = $existingKeys.Add($key)
    }

    $deltaItems = @()
    foreach ($item in $CurrentInventory) {
        $itemKey = "$($item.ComputerName)|$($item.UserName)|$($item.ExtensionID)|$($item.Version)".ToLower()

        if (-not $existingKeys.Contains($itemKey)) {
            $status = if ($ExistingRecords.Count -eq 0) { "Initial Scan" } else { "New/Updated" }
            
            $deltaItems += [PSCustomObject]@{
                "ScanDate"      = $ScanTimestamp
                "ComputerName"  = $item.ComputerName
                "UserName"      = $item.UserName
                "ExtensionID"   = $item.ExtensionID
                "ExtensionName" = $item.ExtensionName
                "Version"       = $item.Version
                "Status"        = $status
                "Publisher"     = $item.Publisher
            }
        }
    }

    return $deltaItems
}

# -----------------------------------------------------------------------------
# Main Execution Flow
# -----------------------------------------------------------------------------

$runningIdentity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$timestamp       = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " SYSTEM-Wide VS Code Extension Inventory & SharePoint Sync" -ForegroundColor Cyan
Write-Host " Running As Context: $runningIdentity | Machine: $env:COMPUTERNAME" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# Step 1: Scan ALL user profiles for VS Code extensions
$installedExts = Get-AllUsersVSCodeExtensions
Write-Host "Scanned all user profiles. Found $($installedExts.Count) VS Code extension(s) total across system." -ForegroundColor Green

if ($installedExts.Count -eq 0) {
    Write-Host "No VS Code extensions found in any user profile on this machine." -ForegroundColor Yellow
    exit 0
}

# Temporary workspace directory for CSV processing
$tempDirectory = Join-Path $env:TEMP "VSCodeInventory"
if (-not (Test-Path $tempDirectory)) {
    New-Item -Path $tempDirectory -ItemType Directory -Force | Out-Null
}
$tempCsvPath = Join-Path $tempDirectory $CsvFileName

# Step 2: Handle SharePoint Upload / Local Sync
if ($Mode -eq "PnPCloud") {
    Write-Host "`nConnecting to SharePoint Site: $SharePointSiteUrl..." -ForegroundColor Cyan

    if (-not (Get-Module -ListAvailable -Name PnP.PowerShell)) {
        Write-Error "PnP.PowerShell module is not installed. Run: Install-Module PnP.PowerShell -Scope CurrentUser"
        exit 1
    }

    try {
        if ($ClientId -and $ClientSecret -and $TenantId) {
            # Headless System-Context Authentication (Azure AD App Registration)
            Connect-PnPOnline -Url $SharePointSiteUrl -ClientId $ClientId -ClientSecret $ClientSecret -Tenant $TenantId -ErrorAction Stop
            Write-Host "Connected headlessly to SharePoint via App Registration!" -ForegroundColor Green
        } else {
            # Interactive Authentication
            Connect-PnPOnline -Url $SharePointSiteUrl -Interactive -ErrorAction Stop
            Write-Host "Connected successfully to SharePoint!" -ForegroundColor Green
        }
    } catch {
        Write-Error "Failed to connect to SharePoint: $_"
        exit 1
    }

    # Download existing CSV file from SharePoint
    $existingRecords = @()
    $spFileUrl = "/sites/$(Split-Path $SharePointSiteUrl -Leaf)/$LibraryName/$CsvFileName"
    
    try {
        Get-PnPFile -Url $spFileUrl -Path $tempDirectory -Filename $CsvFileName -AsFile -Force -ErrorAction SilentlyContinue | Out-Null
        if (Test-Path $tempCsvPath) {
            $existingRecords = Import-Csv -Path $tempCsvPath
            Write-Host "Downloaded existing inventory from SharePoint. Loaded $($existingRecords.Count) record(s)." -ForegroundColor Gray
        }
    } catch {
        Write-Host "No existing inventory found on SharePoint. Creating new inventory file." -ForegroundColor Yellow
    }

    # Compute Delta
    $deltaItems = Get-DeltaInventory -CurrentInventory $installedExts -ExistingRecords $existingRecords -ScanTimestamp $timestamp

    if ($deltaItems.Count -gt 0) {
        Write-Host "`nFound $($deltaItems.Count) NEW or UPDATED extension(s) across users:" -ForegroundColor Green
        $deltaItems | Format-Table -Property ComputerName, UserName, ExtensionID, ExtensionName, Version, Status -AutoSize

        # Append to CSV
        if (Test-Path $tempCsvPath) {
            $deltaItems | Export-Csv -Path $tempCsvPath -Append -NoTypeInformation -Encoding UTF8
        } else {
            $deltaItems | Export-Csv -Path $tempCsvPath -NoTypeInformation -Encoding UTF8
        }

        # Upload to SharePoint
        Write-Host "Uploading updated inventory CSV to SharePoint Library '$LibraryName'..." -ForegroundColor Cyan
        Add-PnPFile -Path $tempCsvPath -Folder $LibraryName -Values @{Title="VS Code Extension Inventory"} -ErrorAction Stop | Out-Null
        Write-Host "Upload Complete! Live multi-user data updated in SharePoint." -ForegroundColor Green
    } else {
        Write-Host "`nNo changes detected. SharePoint inventory is up to date!" -ForegroundColor Yellow
    }

    Disconnect-PnPOnline
}
elseif ($Mode -eq "LocalSync") {
    if ([string]::IsNullOrWhiteSpace($SyncedFolderPath) -or (-not (Test-Path $SyncedFolderPath))) {
        Write-Error "Please specify a valid -SyncedFolderPath pointing to your company's synced SharePoint or shared folder."
        exit 1
    }

    $targetCsvPath = Join-Path $SyncedFolderPath $CsvFileName

    $existingRecords = @()
    if (Test-Path $targetCsvPath) {
        try {
            $existingRecords = Import-Csv -Path $targetCsvPath -ErrorAction Stop
            Write-Host "Loaded $($existingRecords.Count) existing records from CSV for delta comparison." -ForegroundColor Gray
        } catch {
            Write-Warning "Could not read existing file ($targetCsvPath). Creating fresh scan."
        }
    }

    $deltaItems = Get-DeltaInventory -CurrentInventory $installedExts -ExistingRecords $existingRecords -ScanTimestamp $timestamp

    if ($deltaItems.Count -gt 0) {
        Write-Host "`nFound $($deltaItems.Count) NEW or UPDATED extension(s) across users:" -ForegroundColor Green
        $deltaItems | Format-Table -Property ComputerName, UserName, ExtensionID, ExtensionName, Version, Status -AutoSize

        if (Test-Path $targetCsvPath) {
            $deltaItems | Export-Csv -Path $targetCsvPath -Append -NoTypeInformation -Encoding UTF8
        } else {
            $deltaItems | Export-Csv -Path $targetCsvPath -NoTypeInformation -Encoding UTF8
        }

        Write-Host "Successfully written delta records to synced path: $targetCsvPath" -ForegroundColor Green
    } else {
        Write-Host "`nNo changes detected. Synced inventory CSV is up to date!" -ForegroundColor Yellow
    }
}
