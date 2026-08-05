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

    # If no extensions installed at all, system is compliant
    if ($currentExtensions.Count -eq 0) {
        Write-Output "Compliant: No VS Code extensions found on system."
        exit 0
    }

    # If cache file missing, remediation is needed
    if (-not (Test-Path $cacheFile)) {
        Write-Output "Non-Compliant: Local inventory cache missing. Triggering Remediation."
        exit 1
    }

    # Load cache and compare state
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
