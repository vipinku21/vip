# VS Code Private Extension Marketplace: The Ultimate Deployment Guide

This guide is designed for IT administrators, security managers, and coordinators to implement an internal, private extension marketplace for Visual Studio Code (and VSCodium). It outlines the **5 available methods**, their requirements, pros and cons, and simple setup steps.

---

## Executive Summary: Quick Comparison

| Method | User Experience | Server Required? | Legal Complexity | Ideal For |
| :--- | :--- | :--- | :--- | :--- |
| **1. Coder (Lightweight Server)** | Excellent | Yes (Virtual Machine) | High (Requires VSCodium) | Small-to-medium teams |
| **2. Open VSX (Full Clone)** | Excellent (Has Web UI) | Yes (Container Host) | High (Requires VSCodium) | Large developer teams |
| **3. GitHub Native Marketplace** | Seamless (Official) | No (Cloud/SaaS) | Low (Fully Compliant) | GitHub Enterprise Customers |
| **4. Network Share (SMB)** | Medium (Command-Line) | No (Filesystem only) | Low (Fully Compliant) | Standard local offices |
| **5. Custom Web Marketplace API** | Excellent | Yes (App Server + DB) | Low (Fully Compliant) | Full Custom Control & Branding |

---

## Method 1: Coder `code-marketplace` (Lightweight Server)

### Non-Technical Overview
This method uses a small program that runs in the background on one of your company's servers. It watches a folder on that server where you put approved extension files (`.vsix`). When a developer searches for an extension, the program shows them only the files in that folder.

### Requirements Before Choosing
1. A Windows or Linux server on your internal network (Virtual Machine).
2. Network access to allow users to reach this server via HTTP (Port 8080).
3. **VSCodium Client:** Because of Microsoft licensing limits, you must install the open-source editor VSCodium on users' computers instead of official VS Code.

### Pros & Cons
* **Pros:** Extremely lightweight; runs instantly; very low CPU/RAM usage.
* **Cons:** No web page/interface for users to browse extensions; requires VSCodium deployment.

### Easy Setup Steps (For Non-Tech Admins)
1. **Create your folders:** On your server, create a folder named `C:\code-marketplace` and a sub-folder inside it named `extensions`.
2. **Download the server file:** Download the server file (`code-marketplace-windows-amd64.exe`) from GitHub, put it in `C:\code-marketplace`, and rename it to `code-marketplace.exe`.
3. **Start the server:** Open PowerShell on the server and run:
   ```cmd
   C:\code-marketplace\code-marketplace.exe --extensions-dir="C:\code-marketplace\extensions" --port=8080
   ```
4. **Put extensions in the folder:** Drag and drop your approved `.vsix` extension files into `C:\code-marketplace\extensions`.
5. **Configure users' computers:** Push the registry redirection script via Intune to point users' editors to `http://<your-server-ip>:8080/api`.

---

## Method 2: Eclipse Open VSX Registry (Full Clone with Web UI)

### Non-Technical Overview
This is a complete clone of the public VS Code Marketplace. It runs on your servers and comes with a beautiful web page where developers can log in, search for extensions, upload their own custom extensions, and read documentations.

### Requirements Before Choosing
1. A server that can run containers (Docker and Docker Compose installed).
2. An internal SQL Database (PostgreSQL).
3. **VSCodium Client:** Requires deploying VSCodium to users' computers.

### Pros & Cons
* **Pros:** Beautiful web interface; developers can browse extensions in their web browsers; supports automated syncing with the public marketplace.
* **Cons:** Complex to install and maintain; requires managing databases and backups.

### Easy Setup Steps (For Non-Tech Admins)
1. **Create the configuration file:** On your Docker server, create a file named `docker-compose.yml`.
2. **Copy the setup code:** Paste the Docker Compose code block (found in Section 5 of our main guide) into that file and save it.
3. **Run the server:** Open a terminal in that folder and type:
   ```bash
   docker-compose up -d
   ```
4. **Access the portal:** Open your web browser and go to `http://<your-server-ip>:8080` to see your new private App Store.
5. **Configure users:** Redirect users' editors to your Open VSX server URL using Intune registry settings.

---

## Method 3: Native VS Code Private Marketplace (Official SaaS / Cloud)

### Non-Technical Overview
This is the official, Microsoft-approved cloud marketplace. Instead of setting up servers, you configure the settings inside your company's **GitHub Enterprise** portal. Developers sign in to VS Code using their GitHub accounts and instantly see your custom marketplace tab.

### Requirements Before Choosing
1. An active subscription to **GitHub Enterprise Cloud, Copilot Business, or Copilot Enterprise**.
2. Developers must sign in to VS Code with their company GitHub credentials.
3. **Official VS Code:** You can use the official Microsoft VS Code (no VSCodium required).

### Pros & Cons
* **Pros:** Zero local servers to manage; 100% legal compliance with Microsoft's terms; seamless user experience inside the standard VS Code application.
* **Cons:** Requires a paid GitHub Enterprise or Copilot subscription.

### Easy Setup Steps (For Non-Tech Admins)
1. **Access Settings:** Log in to your GitHub Enterprise admin portal.
2. **Enable Marketplace:** Navigate to **Settings > Developer Settings > VS Code Marketplace** and check the box to enable **Private Marketplace**.
3. **Add Extensions:** Search the catalog and check the boxes next to the extensions you want to approve for your company.
4. **User Sign-In:** Instruct your developers to open VS Code and click the **Accounts** icon (bottom-left) to sign in with their corporate GitHub account.
5. **Done:** The curated list of extensions will automatically appear in their extensions search tab.

---

## Method 4: Local Network Share (SMB) (Serverless File Setup)

### Non-Technical Overview
This method uses a shared folder on your company's network (just like a shared drive where you store office files). You place the approved extension files (`.vsix`) there, and developers use a command line to install them directly from the share.

### Requirements Before Choosing
1. A standard company file server or shared network folder (e.g. Active Directory file share).
2. Users' computers must be connected to the corporate network (or VPN) to access the folder.

### Pros & Cons
* **Pros:** Zero server software to maintain; completely compliant with Microsoft licenses; takes 5 minutes to set up.
* **Cons:** No search bar interface inside the editor; developers must install extensions using the terminal or command line.

### Easy Setup Steps (For Non-Tech Admins)
1. **Create a shared folder:** Create a folder on your corporate file server (e.g., named `VsixShare`).
2. **Set permissions:** Set the folder sharing permissions to **Read-Only** for all users, and **Full Control** for the IT Admin.
3. **Copy extension files:** Copy the approved `.vsix` files into this shared folder.
4. **How users install:** Tell your users to open their terminal/Command Prompt and run the install command:
   ```cmd
   code --install-extension \\yourserver\VsixShare\prettier-extension-name.vsix
   ```

---

## Method 5: Custom Web Marketplace API (Full Custom Control)

### Non-Technical Overview
Your web developers build a custom website or backend API that acts exactly like Microsoft's marketplace search engine. You control the styling, the databases, and the security rules. When users search inside VS Code, the editor queries your custom website and displays only the extensions returned by your custom code.

### Requirements Before Choosing
1. A web application host (such as Docker containers or Virtual Machines running Node.js, Go, or .NET).
2. An internal SQL Database (PostgreSQL/SQL Server) to store metadata.
3. A file storage server (e.g., Azure Blob Storage or AWS S3) to host `.vsix` packages.
4. A valid SSL certificate (VS Code **requires HTTPS** to communicate with custom registries).
5. **Official VS Code:** Fully compliant; works with official Microsoft VS Code and VSCodium.

### Pros & Cons
* **Pros:** Complete custom control over search logic, logs, auditing, and corporate branding; full compliance with Microsoft EULA; no VSCodium requirement.
* **Cons:** Requires active developer resources to write, secure, and maintain the custom search API endpoints.

### Developer API Specifications (For Your Web Team)
To make this work, your developers must expose a `POST` endpoint that handles queries sent by the VS Code search bar:

* **Endpoint:** `POST https://marketplace.yourcompany.com/_apis/public/gallery/extensionquery`
* **Expected Request JSON Structure:**
  ```json
  {
    "filters": [
      {
        "criteria": [
          { "filterType": 8, "value": "Microsoft.VisualStudio.Code" },
          { "filterType": 10, "value": "SearchTerm" }
        ],
        "pageNumber": 1,
        "pageSize": 50
      }
    ]
  }
  ```
* **Expected Response JSON Structure:**
  Your server must search your database and return a JSON payload with a `200 OK` containing the metadata and download links. Ensure the download file is served under the asset type `Microsoft.VisualStudio.Services.VSIXPackage`:
  ```json
  {
    "results": [
      {
        "extensions": [
          {
            "publisher": { "publisherName": "esbenp" },
            "extensionName": "prettier-vscode",
            "displayName": "Prettier - Code Formatter",
            "versions": [
              {
                "version": "10.1.0",
                "files": [
                  {
                    "assetType": "Microsoft.VisualStudio.Services.VSIXPackage",
                    "source": "https://marketplace.yourcompany.com/files/prettier-10.1.0.vsix"
                  }
                ]
              }
            ]
          }
        ]
      }
    ]
  }
  ```

---

## IT Admin Tool: Automating Extension Downloads

IT administrators can download vetted extensions from Microsoft's public marketplace using this PowerShell script to build the `.vsix` repository for **Methods 1, 2, 4, and 5**.

### Download Script (`Download-Extension.ps1`)
```powershell
param (
    [Parameter(Mandatory=$true)]
    [string]$ExtensionId, # Example: "esbenp.prettier-vscode"
    
    [Parameter(Mandatory=$true)]
    [string]$Version,     # Example: "10.1.0"
    
    [string]$OutputDir = "C:\VsixStore"
)

# Parse publisher and name
$parts = $ExtensionId.Split('.')
if ($parts.Count -ne 2) {
    Write-Error "Invalid ID format. Use 'publisher.name'"
    exit 1
}
$publisher = $parts[0]
$extName = $parts[1]

# Construct Microsoft CDN Download URL
$url = "https://marketplace.visualstudio.com/_apis/public/gallery/publishers/$publisher/vsextensions/$extName/$Version/vspackage"
$outputFile = Join-Path $OutputDir "$ExtensionId-$Version.vsix"

Write-Host "Downloading $ExtensionId v$Version..." -ForegroundColor Cyan
try {
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $session.UserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
    Invoke-WebRequest -Uri $url -OutFile $outputFile -WebSession $session -TimeoutSec 30
    Write-Host "Success! Saved to $outputFile" -ForegroundColor Green
}
catch {
    Write-Error "Failed to download. Check connection or parameters. Error: $_"
}
```

---

## Official Microsoft & Open-Source References

* **VS Code Enterprise Policy Guidelines:** [https://code.visualstudio.com/docs/setup/enterprise](https://code.visualstudio.com/docs/setup/enterprise)
* **Allowed Extensions Reference:** [https://code.visualstudio.com/docs/setup/enterprise#_allowed-extensions](https://code.visualstudio.com/docs/setup/enterprise#_allowed-extensions)
* **Visual Studio Marketplace Terms of Use:** [https://aka.ms/VSMarketplace-TOU](https://aka.ms/VSMarketplace-TOU)
* **VSCodium Extensions Marketplace Docs:** [https://github.com/VSCodium/vscodium/blob/master/docs/index.md#extensions-marketplace](https://github.com/VSCodium/vscodium/blob/master/docs/index.md#extensions-marketplace)
* **Eclipse Open VSX Registry Server:** [https://github.com/eclipse/openvsx](https://github.com/eclipse/openvsx)
* **Coder Code-Marketplace Project Page:** [https://github.com/coder/code-marketplace](https://github.com/coder/code-marketplace)
