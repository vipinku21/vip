# Define registry path and values (PowerShell format)
$regpath = "HKLM:\SOFTWARE\Policies\Microsoft\VSCode"
$allowedExtensionsName = "AllowedExtensions"
$allowedExtensionsValue = '{"microsoft" :true, "blackboxapp" :false, "github" :"stable", "dbaeumer.vscode-eslint" :["3.0.20", "3.0.16"], "ritwickdey.liveserver" :true, "ms-azuretools.vscode-azurecontainerapps" :false}' # must put a space before the colon
$updateModeName = "UpdateMode"
$updateModeValue = "default" # Options: none, manual, start, default

try {
    # Create the registry path if it doesn't exist
    if (-not (Test-Path $regpath)) {
        Write-Host "Creating registry path: $regpath"
        New-Item -Path $regpath -Force | Out-Null
    }

    # Set AllowedExtensions value
    Write-Host "Setting AllowedExtensions policy"
    Set-ItemProperty -Path $regpath -Name $allowedExtensionsName -Value $allowedExtensionsValue -Type String -Force

    # Set UpdateMode value
    Write-Host "Setting UpdateMode policy"
    Set-ItemProperty -Path $regpath -Name $updateModeName -Value $updateModeValue -Type String -Force

    Write-Host "VS Code policies configured successfully"
    exit 0 # Success
}
catch {
    Write-Error "Failed to configure VS Code policies: $_"
    exit 1 # Failure
}
