# The Intune Challenge: Registry Path Restrictions

## Why Standard Approaches Don't Work
Microsoft Intune has a critical restriction that affects VS Code policy deployment:

* **Intune BLOCKS direct writes to:** `HKLM\SOFTWARE\Policies\Microsoft\*`
* This path is reserved for traditional Group Policy Objects (GPO) to prevent conflicts in hybrid environments.

### Failed Approaches
* [x] **ADMX Template Import:** Cannot write to blocked registry path
* [x] **Settings Catalog:** Blocked from `Software\Policies\Microsoft\*`
* [x] **Custom OMA-URI:** Same registry restriction applies
* [x] **Direct Registry Configuration:** Blocked by Intune design

### The Working Solution
* [checkmark] **PowerShell Remediation Scripts** running with `SYSTEM` privileges can write to the restricted registry location because they bypass the Settings Catalog restrictions.
