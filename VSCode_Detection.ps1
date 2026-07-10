# Detection script - Checks if VS Code is installed (machine or user) and meets minimum version requirement (v1.96)
# Designed for Intune Proactive Remediations running in SYSTEM context

# Define registry path, value name and version requirement
$regpath = "HKLM:\SOFTWARE\Policies\Microsoft\VSCode"
$name = "AllowedExtensions"
$minimumVersion = [version]"1.96.0"

$vsCodePath = $null
$installType = $null

# Check machine-wide installation
$machinePath = "$env:ProgramFiles\Microsoft VS Code\Code.exe"

if (Test-Path $machinePath) {
    $vsCodePath = $machinePath
    $installType = "Machine"
}

# Check user installations across all profiles because VS Code is commonly installed per-user
if (-not $vsCodePath) {
    Get-ChildItem "C:\Users" -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        $userCodePath = Join-Path $_.FullName "AppData\Local\Programs\Microsoft VS Code\Code.exe"
        if (Test-Path $userCodePath) {
            $vsCodePath = $userCodePath
            $installType = "User ($($_.Name))"
            Write-Host "VS Code Installed at Path: $vsCodePath (Installation Type: $installType)"
            return
        }
    }
}

if (-not $vsCodePath) {
    Write-Host "VS Code not installed - no action needed"
    exit 0
}

# Retrieve installed version from executable
try {
    $versionInfo = (Get-Item $vsCodePath).VersionInfo.ProductVersion
    $installedVersion = [version]$versionInfo
}
catch {
    Write-Host "Unable to determine VS Code version - skipping remediation"
    exit 0
}

Write-Host "Found: Microsoft Visual Studio Code ($installType), v$installedVersion"

# Validate minimum version requirement
if ($installedVersion -lt $minimumVersion) {
    Write-Host "VS Code v$installedVersion is below minimum required v$minimumVersion - policies not supported"
    exit 0
}

# Check if policies are configured correctly
if (Get-ItemProperty -Path $regpath -Name $name -ErrorAction SilentlyContinue) {
    Write-Host "Policy exists - compliant"
    exit 0
} else {
    Write-Host "Policy missing - remediation required"
    exit 1
}
