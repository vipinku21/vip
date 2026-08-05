<#
.SYNOPSIS
    Azure Function (PowerShell HTTP Trigger)
    Receives VS Code Extension Inventory JSON payload from Intune endpoints,
    validates the data, performs Delta comparison against SharePoint Online, and inserts reporting data.

.DESCRIPTION
    Deploy this script into an Azure Function App (PowerShell runtime).
    Supports TWO SharePoint Data Destination Modes:
      1. "SharePointList"  -> Appends items directly into a SharePoint List using Add-PnPListItem (Recommended for Power BI & Reporting)
      2. "SharePointCsv"   -> Downloads, appends, and uploads a CSV file in a SharePoint Document Library using Add-PnPFile
#>

using namespace System.Net

param($Request, $TriggerMetadata)

# 1. Parse incoming JSON payload from Intune Endpoint
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

# 2. Environment Configuration from Azure Function Settings
$siteUrl       = $env:SharePointSiteUrl               # e.g., "https://yourcompany.sharepoint.com/sites/ITInventory"
$destination   = if ($env:DestinationMode) { $env:DestinationMode } else { "SharePointList" } # "SharePointList" or "SharePointCsv"
$listName      = if ($env:ListName) { $env:ListName } else { "VSCodeExtensionInventory" }     # SharePoint List Name
$libName       = if ($env:LibraryName) { $env:LibraryName } else { "Shared Documents" }       # Document Library Name
$fileName      = if ($env:CsvFileName) { $env:CsvFileName } else { "VSCode_Extension_Inventory.csv" }
$clientId      = $env:ClientId
$tenantId      = $env:TenantId
$secret        = $env:ClientSecret

try {
    # 3. Authenticate to SharePoint Online
    if ($clientId -and $secret -and $tenantId) {
        Connect-PnPOnline -Url $siteUrl -ClientId $clientId -ClientSecret $secret -Tenant $tenantId -ErrorAction Stop
    } else {
        # Connect using Azure Function Managed Identity
        Connect-PnPOnline -Url $siteUrl -ManagedIdentity -ErrorAction Stop
    }

    # =========================================================================
    # DESTINATION METHOD 1: SHAREPOINT LIST (Add-PnPListItem) - RECOMMENDED
    # =========================================================================
    if ($destination -eq "SharePointList") {
        
        # Ensure SharePoint List exists, or create it automatically
        $list = Get-PnPList -Identity $listName -ErrorAction SilentlyContinue
        if (-not $list) {
            Write-Host "Creating SharePoint List '$listName'..."
            $list = New-PnPList -Title $listName -Template GenericList -ErrorAction Stop
            
            # Add columns to SharePoint List
            Add-PnPField -List $listName -DisplayName "ComputerName" -InternalName "ComputerName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "UserName" -InternalName "UserName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionID" -InternalName "ExtensionID" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionName" -InternalName "ExtensionName" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ExtensionVersion" -InternalName "ExtensionVersion" -Type Text -AddToDefaultView | Out-Null
            Add-PnPField -List $listName -DisplayName "ScanDate" -InternalName "ScanDate" -Type Text -AddToDefaultView | Out-Null
        }

        # Fetch existing records from SharePoint List for Delta Comparison
        $existingItems = Get-PnPListItem -List $listName -PageSize 2000 -Fields "ComputerName", "UserName", "ExtensionID", "ExtensionVersion"
        $existingKeys = [System.Collections.Generic.HashSet[string]]::new()

        foreach ($item in $existingItems) {
            $cName = $item["ComputerName"]
            $uName = $item["UserName"]
            $eId   = $item["ExtensionID"]
            $ver   = $item["ExtensionVersion"]
            
            $key = "$cName|$uName|$eId|$ver".ToLower()
            $null = $existingKeys.Add($key)
        }

        # Insert Delta Rows into SharePoint List
        $insertedCount = 0
        foreach ($ext in $extensions) {
            $itemKey = "$computerName|$($ext.userName)|$($ext.extensionId)|$($ext.version)".ToLower()

            if (-not $existingKeys.Contains($itemKey)) {
                # Add item directly to SharePoint List
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

    # =========================================================================
    # DESTINATION METHOD 2: SHAREPOINT DOCUMENT LIBRARY CSV (Add-PnPFile)
    # =========================================================================
    elseif ($destination -eq "SharePointCsv") {
        $tempPath = [System.IO.Path]::GetTempPath()
        $localCsvPath = Join-Path $tempPath $fileName
        $spFileUrl = "/sites/$(Split-Path $siteUrl -Leaf)/$libName/$fileName"
        $existingRecords = @()

        # Download current CSV file from SharePoint Document Library
        try {
            Get-PnPFile -Url $spFileUrl -Path $tempPath -Filename $fileName -AsFile -Force -ErrorAction SilentlyContinue | Out-Null
            if (Test-Path $localCsvPath) {
                $existingRecords = Import-Csv -Path $localCsvPath
            }
        } catch {}

        # Build lookup table of existing rows
        $existingKeys = [System.Collections.Generic.HashSet[string]]::new()
        foreach ($rec in $existingRecords) {
            $key = "$($rec.ComputerName)|$($rec.UserName)|$($rec.ExtensionID)|$($rec.Version)".ToLower()
            $null = $existingKeys.Add($key)
        }

        # Filter new or updated items
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

        # Append new records and upload CSV back to SharePoint Document Library
        if ($deltaItems.Count -gt 0) {
            if (Test-Path $localCsvPath) {
                $deltaItems | Export-Csv -Path $localCsvPath -Append -NoTypeInformation -Encoding UTF8
            } else {
                $deltaItems | Export-Csv -Path $localCsvPath -NoTypeInformation -Encoding UTF8
            }

            # Upload updated CSV file to SharePoint Document Library
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
