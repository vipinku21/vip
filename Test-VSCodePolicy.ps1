# Test-VSCodePolicy.ps1
# Helper script to test the VS Code policy detection and remediation locally on a client machine

Write-Host "--- Running Detection Script ---" -ForegroundColor Cyan
. .\VSCode_Detection.ps1

$detectionExit = $LASTEXITCODE
Write-Host "Detection Exit Code: $detectionExit"

if ($detectionExit -eq 1) {
    Write-Host "Device is non-compliant. Running Remediation Script..." -ForegroundColor Yellow
    . .\VSCode_Remediation.ps1
    $remediationExit = $LASTEXITCODE
    Write-Host "Remediation Exit Code: $remediationExit"
    
    if ($remediationExit -eq 0) {
        Write-Host "Remediation succeeded. Running Detection Script again to verify..." -ForegroundColor Cyan
        . .\VSCode_Detection.ps1
    } else {
        Write-Host "Remediation failed!" -ForegroundColor Red
    }
} else {
    Write-Host "Device is already compliant. No action needed." -ForegroundColor Green
}
