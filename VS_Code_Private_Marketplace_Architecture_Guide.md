# VS Code Custom Marketplace: Architecture & Sync Guide

This document outlines the detailed architecture, resource requirements, and automated syncing strategies for hosting a custom Visual Studio Code Extension Marketplace.

---

## 1. How the Custom Marketplace Architecture Works

When VS Code is pointed to a custom marketplace URL, the editor communicates using a specific request lifecycle:

```
[ Developer Client ]                     [ Custom Web API ]                    [ Database / Storage ]
        |                                        |                                        |
        |---- 1. Search Query (POST) ----------->|                                        |
        |                                        |---- 2. Query Metadata ---------------->|
        |                                        |<--- 3. Return Metadata ----------------|
        |<--- 4. JSON Search Results ------------|                                        |
        |                                                                                 |
        |---- 5. Click "Install" (Download) --------------------------------------------->| (VSIX File)
```

1. **Query Phase:** VS Code sends a JSON query (`POST /extensionquery`) containing the search terms. Your web API searches your SQL database for matching extension names, descriptions, or IDs.
2. **Details/README Phase:** When the user clicks an extension, VS Code requests the documentation asset template (defined in `resourceUrlTemplate`). Your web API returns the raw text of the extension's `README.md` and displays it in the editor window.
3. **Download Phase:** Clicking **Install** triggers a direct file download request to the source URL defined in the JSON query response. This file must be a valid `.vsix` archive.

---

## 2. Required Infrastructure Resources (For 1,000+ Users)

To run a reliable, secure custom marketplace for a large enterprise, the following resources are required:

### A. Compute Layer (Web Application)
* **Hosting:** A Docker Container (Azure App Service, Kubernetes, or AWS ECS) or a virtual machine (Windows Server / Linux VM).
* **Tech Stack:** Any modern web API stack (e.g., Node.js/Express, Go, .NET Core, or Python FastAPI) that can handle JSON requests and return the required gallery schemas.

### B. Database Layer (Metadata Registry)
* **Engine:** PostgreSQL, SQL Server, or MySQL.
* **Schema:** You need tables to store:
  * **Publishers:** (ID, Name, Display Name).
  * **Extensions:** (ID, Name, Display Name, Short Description, Latest Version, Download URL).
  * **Versions:** (Version Number, Release Date, Path to VSIX, Path to README, Path to Icon).

### C. Storage Layer (Asset Repository)
* **Service:** Azure Blob Storage, AWS S3, or a local high-performance file server.
* **Usage:** Hosts the raw `.vsix` files, extension icons (PNG/JPEG), and documentation files (Markdown).

### D. Security & Network
* **SSL Certificate:** VS Code **requires HTTPS** connections. You must configure an SSL certificate (issued by a public CA or your internal Active Directory Certificate Services).
* **Load Balancer / Reverse Proxy:** Nginx or IIS to handle SSL termination, rate-limiting, and redirect traffic to your compute containers.

---

## 3. Automated Upstream Syncing (Auto-Updating)

To ensure your developers have access to the latest updates without you manually downloading `.vsix` files every time, you can implement one of two sync patterns:

### Design A: The Proxy/Cache Model (Zero Maintenance)
In this model, your custom Web API acts as a smart proxy:
1. When a user searches for an extension, your API queries your local database first.
2. If it is a private/proprietary extension, your API returns the local file.
3. If it is a public extension (e.g., GitLens), your API dynamically forwards the search request to Microsoft's public API (`https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery`).
4. Your API caches the returned metadata, downloads the public `.vsix` once to your storage, and returns it to the user.
5. *Result:* Public extensions are updated automatically upon request.

### Design B: The Scheduled Cron Sync (Curated Updates)
If you want to maintain a strict, pre-vetted catalog of allowed extensions and only update them on a schedule (e.g., every night), you run an automated PowerShell sync script.

#### Automated Sync Script (`Sync-Marketplace.ps1`)
This script loops through a list of your approved extensions, checks Microsoft's CDN for newer versions, downloads them, and updates your repository:

```powershell
# Define directories and API details
$ConfigFilePath = "C:\code-marketplace\approved-extensions.json"
$OutputDir = "C:\code-marketplace\extensions"

# Ensure Output Directory exists
if (!(Test-Path $OutputDir)) { New-Item -Path $OutputDir -ItemType Directory -Force | Out-Null }

# Load the list of approved extensions to track
# Format of JSON: { "esbenp.prettier-vscode": "10.1.0", "ms-python.python": "2024.2.0" }
$ApprovedExtensions = Get-Content -Path $ConfigFilePath -Raw | ConvertFrom-Json

# Initialize web session (Microsoft CDN requires User-Agent)
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"

foreach ($property in $ApprovedExtensions.PSObject.Properties) {
    $extId = $property.Name
    $currentVersion = $property.Value
    
    $parts = $extId.Split('.')
    $publisher = $parts[0]
    $name = $parts[1]
    
    Write-Host "Checking $extId (Current: $currentVersion)..." -ForegroundColor Cyan
    
    # 1. Query Microsoft's API to get the latest public version
    $queryUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery"
    $body = @{
        filters = @(
            @{
                criteria = @(
                    @{ filterType = 7; value = $extId } # FilterType 7 = Extension Name
                )
            }
        )
        flags = 914 # Includes files/versions
    } | ConvertTo-Json -Depth 4
    
    try {
        $response = Invoke-RestMethod -Uri $queryUrl -Method Post -Body $body -ContentType "application/json" -WebSession $session
        $latestVersion = $response.results[0].extensions[0].versions[0].version
        
        # 2. Compare versions
        if ([version]$latestVersion -gt [version]$currentVersion) {
            Write-Host "--> New version found: $latestVersion. Downloading..." -ForegroundColor Yellow
            
            # Download the new VSIX
            $downloadUrl = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/$publisher/vsextensions/$name/$latestVersion/vspackage"
            $outputFile = Join-Path $OutputDir "$extId-$latestVersion.vsix"
            
            Invoke-WebRequest -Uri $downloadUrl -OutFile $outputFile -WebSession $session -TimeoutSec 45
            
            # Clean up old version file to save space
            $oldFile = Join-Path $OutputDir "$extId-$currentVersion.vsix"
            if (Test-Path $oldFile) { Remove-Item -Path $oldFile -Force }
            
            # Update the configuration tracking file
            $ApprovedExtensions.$extId = $latestVersion
            Write-Host "Successfully updated $extId to v$latestVersion" -ForegroundColor Green
        } else {
            Write-Host "--> Up to date." -ForegroundColor Gray
        }
    }
    catch {
        Write-Error "Failed to sync $extId. Error: $_"
    }
}

# Save updated config back to JSON
$ApprovedExtensions | ConvertTo-Json | Out-File -FilePath $ConfigFilePath -Force
```

#### Running the Sync Script:
1. Save `Sync-Marketplace.ps1` on your marketplace server.
2. Open **Task Scheduler** on your Windows Server (or set up a Cron Job on Linux).
3. Schedule a task to run daily at 2:00 AM executing:
   ```cmd
   powershell.exe -ExecutionPolicy Bypass -File C:\code-marketplace\Sync-Marketplace.ps1
   ```
4. *Result:* Your local repository directory will always contain the latest approved `.vsix` installers without requiring manual developer actions.
