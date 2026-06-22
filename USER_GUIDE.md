# Extension Policy Manager - User Guide

This guide describes how to open, authorize, and use the **Extension Policy Manager** web interface to manage your organization's browser extension whitelist and blacklist rules.

---

## 1. How to Launch the Webpage

To open the application:
1. Locate your project folder (e.g., `BrowserExtension_Formatter`).
2. Double-click the **`index.html`** file located inside the folder, or drag-and-drop it into any modern web browser (like Google Chrome, Microsoft Edge, or Mozilla Firefox).

---

## 2. Linking and Authorizing the Target File (`policy.json`)

When you launch the page, it runs locally in your browser. Before you can save any changes, you must authorize the application to edit the local configuration file:

1. Locate the brown banner at the top of the page that says: **"Linked to: policy.json. Click button to authorize writing."**
2. Click the **"Authorize Write"** button on the right side of this banner.
3. Your web browser will display a security prompt (e.g., *"Allow this site to edit files?"*). Click **Allow** or **Save Changes** to grant the page write access.
4. The status indicator in the top-right corner will change from **Awaiting Authorization** to **Authorized**.

```text
========================================================================
[ PLACEHOLDER: Insert Screenshot 1 (Header Banner & Authorize Write Button) ]
========================================================================
```

---

## 3. Viewing the Dashboard Statistics

Once authorized, the page loads your current rules. The dashboard widgets display real-time counters:
* **Total Rules**: The total count of extension rules configured.
* **Allowed**: The count of whitelisted extensions.
* **Blocked**: The count of restricted/blacklisted extensions.

```text
========================================================================
[ PLACEHOLDER: Insert Screenshot 2 (Dashboard Statistics Cards) ]
========================================================================
```

---

## 4. Modifying and Creating Rules

To add a new browser rule or update an existing one, use the **Configure Rule** section in the left column:

1. **Extension ID / Scope**: 
   * Type the ID of the browser extension you want to configure (e.g., `uBlock0@raymondhill.net`).
   * Type **`*`** if you want to set the global default policy for all extensions.
2. **Installation Mode**: Select the desired permission from the dropdown list:
   * **Allowed**: Users are allowed to install this extension.
   * **Blocked**: The extension is blacklisted. Selecting this option opens an optional **Custom Block Message** box where you can type an explanation to display to users when installation is restricted.
3. **Save**: Click the **Save Configuration** button at the bottom of the form to commit the rule directly to the target `policy.json` file.

```text
========================================================================
[ PLACEHOLDER: Insert Screenshot 3 (Configure Rule Form Section) ]
========================================================================
```

---

## 5. Managing Active Policies

The **Active Policies** table in the right column displays all configured extension rules:

* **Searching**: Use the **Filter by Extension ID...** search bar to quickly locate a rule by its ID.
* **Editing a Rule**: Click the **Pencil (Edit)** icon next to any rule. This loads the rule details back into the *Configure Rule* form, allowing you to update the settings.
* **Deleting a Rule**: Click the **Trash Can (Delete)** icon next to a rule and confirm the prompt to permanently remove it from the configuration.

```text
========================================================================
[ PLACEHOLDER: Insert Screenshot 4 (Active Policies Rules Table) ]
========================================================================
```

---

## 6. Live JSON Preview & Utility Buttons

The **Live JSON Preview** block shows the structured configuration of the `policy.json` file. You can use the buttons at the top of the preview to perform quick actions:

* **Import**: Paste raw JSON code or upload a file to import existing rules.
* **Download**: Save a local copy of the `policy.json` file to your computer.
* **Copy**: Copy the entire JSON code to your clipboard in one click.
* **Reset**: Revert the rules back to the original default templates.

```text
========================================================================
[ PLACEHOLDER: Insert Screenshot 5 (Live JSON Preview & Action Buttons) ]
========================================================================
```
