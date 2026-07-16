# VS Code Registry Policies: Layman's Management Guide

This guide explains how to control Visual Studio Code (VS Code) extensions using the Windows Registry. We cover two specific methods: **Publisher-Based Control** (allowing whole brands/creators) and **User-Based Control** (customizing rules for different people using the same computer).

---

## Part 1: Publisher-Based Control (Allowing Whole Brands)

### What is it? (Simple Analogy)
Think of a publisher as a "brand" or "company" that makes apps. For example, Microsoft, GitHub, and RedHat are all publishers. 

Instead of typing in a list of 50 individual extensions you want to allow, **Publisher-Based Control** lets you write a policy that says: *"I trust Microsoft. Let users install anything made by Microsoft."* Any extension made by other unlisted companies will be blocked automatically.

### Why use it?
* Saves time (you don't have to list every single tool ID).
* Great for general developers who need standard programming tools but should be blocked from installing unknown or unsafe plugins.

### Example Configuration (How it looks inside the Registry)
In the registry, the configuration is stored as a JSON text string:
```json
{
  "microsoft" :true,
  "github" :true,
  "redhat" :true,
  "*" :false
}
```
* `"microsoft" :true` means **Allow** any extension created by Microsoft.
* `"github" :true` means **Allow** any extension created by GitHub.
* `"*": false` means **Block** everything else from any other publisher.

### Simple Steps to Setup (For Non-Tech Admins)
1. **Open Registry Editor:** Click your Windows Start button, type `regedit`, and press Enter.
2. **Navigate to the VS Code Policy Folder:** Go to this folder on the left sidebar:
   `HKEY_LOCAL_MACHINE\SOFTWARE\Policies\Microsoft\VSCode`
   *(If the "VSCode" folder doesn't exist, right-click the "Microsoft" folder, select **New > Key**, and name it `VSCode`).*
3. **Create the Policy Value:**
   * Right-click the `VSCode` folder on the left, select **New > String Value**, and name it `allowed`.
4. **Paste your allowed publishers:**
   * Double-click the new `allowed` value you created, and paste the JSON text string (from the example above) into the box.
   * Click **OK**.
5. **Test it:** Open VS Code. If you try to install a Microsoft extension, it works. If you try to install an extension by an unlisted publisher, the "Install" button will be blocked.

---

## Part 2: User-Based Control (HKCU - Rules that Follow the Person)

### What is it? (Simple Analogy)
Think of the registry as having two main storage lockers:
1. **HKEY_LOCAL_MACHINE (HKLM):** The "Computer Locker". Any setting placed here applies to the physical computer. No matter who logs in, they get the exact same rules.
2. **HKEY_CURRENT_USER (HKCU):** The "User Locker". Any setting placed here applies *only* to the person currently logged into Windows.

**User-Based Control** writes settings to the "User Locker" (HKCU). This means if Jason logs in, he gets his specific developer tools. If Kevin logs in to the same computer, he gets his database tools. If an administrator logs in, they can install whatever they need.

### Why use it?
* Perfect for shared workstations or companies with different roles (e.g. Frontend vs. Backend developers).
* Dynamic and customizable.

### Example Configuration (How it works with Intune)
We write the settings to the user's registry hive:
`HKEY_CURRENT_USER\SOFTWARE\Policies\Microsoft\VSCode\allowed`

Because this is user-specific, we use a PowerShell script deployed via Microsoft Intune. The script runs automatically when a user logs in, checks their username, and writes their unique allowlist to their "User Locker".

### Simple Steps to Setup (For Non-Tech Admins)
1. **Prepare your user lists:** Decide which extensions each user is allowed to have (e.g. Jason gets Prettier and Python; Kevin gets C++ and Git).
2. **Deploy the script in Intune:**
   * Go to your **Microsoft Intune portal**.
   * Navigate to **Devices > Scripts** and upload the `VSCode-Registry-Enforcer.ps1` script (found in Part 1 of our implementation guide).
3. **Set the context to User:**
   * In the Intune settings, set **"Run this script using the logged on credentials"** to **YES**. This is the key step that forces the script to write to the "User Locker" (HKCU) instead of the machine locker.
4. **Done:** When the user logs into their computer, Intune runs the script in the background, checks their name, and configures their registry. VS Code automatically reads these settings on startup.
