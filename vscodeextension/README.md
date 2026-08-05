# VS Code Extension Inventory Collection System (Intune + Azure Function + SharePoint)

An enterprise-grade, automated solution designed to collect installed VS Code extension details across **all user profiles** on 200+ Windows workstations via **Microsoft Intune Proactive Remediations**, and push delta records directly into **SharePoint Online**.

---

## 🏗️ Architecture & Component Overview

```
[ Intune Endpoint (SYSTEM Context) ]
         │
         ├──> 1. Detect-VSCodeExtensionInventory.ps1
         │        └── Scans C:\Users\* for local extensions vs cache. Exits 1 if non-compliant.
         │
         └──> 2. Remediate-VSCodeExtensionInventory.ps1
                  └── Fetches all extension data (UserName, ExtensionID, Name, Version)
                  └── Posts JSON payload over HTTPS to Azure Function Webhook (Zero auth on endpoint)
                           │
                           ▼
            [ Azure Function HTTP Webhook ]
                     │ (Authenticates to SharePoint in Cloud)
                     ▼
            [ SharePoint Online Location ]
               ├── Mode A: SharePoint List (Add-PnPListItem) -> Native Web & Power BI Reporting
               └── Mode B: Document Library (Add-PnPFile)   -> Central VSCode_Extension_Inventory.csv
```

---

## 📁 Repository Files

| File Name | Description |
| :--- | :--- |
| [`Detect-VSCodeExtensionInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Detect-VSCodeExtensionInventory.ps1) | Intune Detection Script. Scans all user profiles and checks if local inventory has unsynced changes. |
| [`Remediate-VSCodeExtensionInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Remediate-VSCodeExtensionInventory.ps1) | Intune Remediation Script. Does all scanning work on endpoint and posts JSON payload to Azure Function URL. |
| [`AzureFunction_SyncVSCodeInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/AzureFunction_SyncVSCodeInventory.ps1) | Backend Azure Function code (PowerShell runtime). Validates incoming payloads and appends delta data to SharePoint. |

---

## ⚙️ How to Change the SharePoint Location

You can easily change the target SharePoint Site URL, Document Library name, or SharePoint List name **without modifying any code on the 200+ endpoint devices**.

### Option A: Change via Azure Function Application Settings (Recommended)

Since the endpoint sends data to the Azure Function, the SharePoint location is controlled centrally in the Azure Portal:

1. Go to **Azure Portal** (`https://portal.azure.com`).
2. Search for and select your **Function App**.
3. In the left navigation menu, under **Settings**, click **Environment variables** (or **Configuration**).
4. Update or add the following Application Settings:

| Environment Variable Key | Sample Value | Description |
| :--- | :--- | :--- |
| `SharePointSiteUrl` | `https://yourcompany.sharepoint.com/sites/NewSiteName` | Target SharePoint Site URL |
| `DestinationMode` | `SharePointList` or `SharePointCsv` | Choose between SharePoint List or CSV Document Library |
| `ListName` | `VSCodeExtensionInventory` | Name of the target SharePoint List |
| `LibraryName` | `Shared Documents` | Document Library name (if using CSV mode) |
| `CsvFileName` | `VSCode_Extension_Inventory.csv` | File name (if using CSV mode) |
| `ClientId` | `00000000-0000-0000-0000-000000000000` | Azure AD App Registration Client ID |
| `TenantId` | `11111111-1111-1111-1111-111111111111` | Azure AD / Entra ID Tenant ID |
| `ClientSecret` | `YourAppSecretValue` | Azure AD App Secret |

5. Click **Apply** and **Save**. All 200+ endpoints will now automatically push data to the new SharePoint location on their next daily run!

---

### Option B: Change Default SharePoint Location directly in Script Code

If you want to update the fallback default values in the Azure Function code file [`AzureFunction_SyncVSCodeInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/AzureFunction_SyncVSCodeInventory.ps1):

Open `AzureFunction_SyncVSCodeInventory.ps1` and locate lines 36-42:

```powershell
# Environment variables & Fallback Default SharePoint Locations
$siteUrl     = if ($env:SharePointSiteUrl) { $env:SharePointSiteUrl } else { "https://yourcompany.sharepoint.com/sites/YOUR_NEW_SITE" }
$destination = if ($env:DestinationMode)   { $env:DestinationMode }   else { "SharePointList" } # "SharePointList" or "SharePointCsv"
$listName    = if ($env:ListName)          { $env:ListName }          else { "YOUR_NEW_LIST_NAME" }
$libName     = if ($env:LibraryName)       { $env:LibraryName }       else { "YOUR_NEW_LIBRARY_NAME" }
$fileName    = if ($env:CsvFileName)       { $env:CsvFileName }       else { "YOUR_NEW_FILE_NAME.csv" }
```

Simply replace `"YOUR_NEW_SITE"`, `"YOUR_NEW_LIST_NAME"`, or `"YOUR_NEW_FILE_NAME.csv"` with your target company SharePoint path.

---

## 🚀 Deployment Instructions

### Step 1: Deploy Azure Function Backend
1. In Azure Portal, create a **Function App** (Runtime stack: **PowerShell Core 7.x**, OS: Windows).
2. Create an **HTTP Trigger** function named `SyncVSCodeInventory`.
3. Copy the contents of [`AzureFunction_SyncVSCodeInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/AzureFunction_SyncVSCodeInventory.ps1) into `run.ps1`.
4. Add the required App Settings (`SharePointSiteUrl`, `ClientId`, `TenantId`, `ClientSecret`).
5. Copy the **Function URL with Key** (e.g., `https://myfunc.azurewebsites.net/api/SyncVSCodeInventory?code=XYZ...`).

### Step 2: Configure Intune Remediation Script
1. Open [`Remediate-VSCodeExtensionInventory.ps1`](file:///c:/Users/vipin/OneDrive/Desktop/automationtestingforvsnotepadd/Remediate-VSCodeExtensionInventory.ps1).
2. Replace `$AzureFunctionUrl` on line 18 with your Function URL copied from Step 1:
   ```powershell
   param(
       [string]$AzureFunctionUrl = "https://myfunc.azurewebsites.net/api/SyncVSCodeInventory?code=YOUR_KEY"
   )
   ```

### Step 3: Deploy Package in Microsoft Intune
1. Sign in to [Microsoft Intune Admin Center](https://intune.microsoft.com).
2. Go to **Devices** -> **Remediations** (or **Scripts & Remediations**).
3. Click **+ Create script package**.
4. Configure Package Details:
   - **Name**: `VS Code Extension Inventory Collector`
   - **Detection script**: Upload `Detect-VSCodeExtensionInventory.ps1`
   - **Remediation script**: Upload `Remediate-VSCodeExtensionInventory.ps1`
   - **Run script using logged-on credentials**: Select **No** (CRITICAL: Runs under SYSTEM context to scan ALL user profiles).
   - **Enforce script signature check**: Select **No**.
   - **Run script in 64-bit PowerShell**: Select **Yes**.
5. **Assignments**: Assign to your target workstation device group (200+ machines) with a **Daily** schedule.

---

## 📊 Data Schema / Reporting Columns

Each entry written to SharePoint contains:

| Column Name | Data Type | Description | Example |
| :--- | :--- | :--- | :--- |
| `ComputerName` | String | Machine hostname | `DESKTOP-DEV01` |
| `UserName` | String | Windows user profile name | `vipin` |
| `ExtensionID` | String | Publisher & Extension Identifier | `ms-python.python` |
| `ExtensionName` | String | Human-readable extension title | `Python` |
| `ExtensionVersion` | String | Installed extension version string | `2026.4.0` |
| `ScanDate` | DateTime | Timestamp when scan occurred | `2026-08-05 12:30:00` |
| `Status` | String | Delta status indicator | `Initial Scan` or `New/Updated` |

---

## ❓ Frequently Asked Questions (FAQ)

#### Q: How does the script scan all users on a shared machine?
The script queries `HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion\ProfileList` and scans `C:\Users\*` to identify every user account that has logged onto the PC and reads their `.vscode\extensions` directory.

#### Q: Do local endpoints require SharePoint login credentials or certificates?
**No.** Endpoints send an HTTP POST request to the Azure Function URL over TLS 1.2. The Azure Function securely handles SharePoint authentication in the Azure cloud.

#### Q: How does Delta matching prevent duplicate records in SharePoint?
The system creates a compound lookup key: `ComputerName + UserName + ExtensionID + Version`. If a user already has `ms-python.python v2026.4.0` recorded in SharePoint, subsequent runs skip adding duplicate rows. When the user updates to `v2026.5.0`, the new version is appended automatically.
