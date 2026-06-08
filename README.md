# Browser Extension Policy Manager

A modern, high-performance, serverless dashboard designed to generate, format, and manage browser extension installation policies. Built entirely on the frontend, it uses the browser's **HTML5 File System Access API** to read and write directly to your local `policy.json` configuration file on disk—requiring **no databases, no external APIs, and no server hosting**.

---

## Key Features

*   **Direct-File Editing (Auto-Save)**: Select your local `policy.json` once, and any configuration changes you make in the UI will write back directly to the file on disk.
*   **Persistent Linking**: Uses IndexedDB to remember your selected file handle. You only need to link your file once; on subsequent visits, just click to authorize write access.
*   **Fallback Local Storage**: If no file is linked, changes are securely stored in your browser's `localStorage` sandbox so you never lose progress.
*   **Live Formatted JSON Preview**: Real-time syntax-highlighted preview of the policies with a one-click copy helper.
*   **Import / Paste JSON**: Easily import existing `policy.json` files or paste raw JSON with strict schema validation.
*   **Reset to Defaults**: Quickly restore a clean configuration featuring 10 default whitelisted/blacklisted extension rules.
*   **Responsive Dark Glassmorphism UI**: Beautiful, interactive interface with real-time statistics (Allowed/Blocked counts) and fast search filters.

---

## How to Run

Because the project runs completely on the frontend, there are two simple ways to run it:

### Option A: Double-Click (Zero Setup)
1.  Navigate to the `public/` directory in your file explorer.
2.  Double-click `index.html` to open it directly in your web browser.
3.  *That's it!* No terminal commands, Node.js installation, or server scripts required.

### Option B: Local Static Server
If you prefer hosting it locally on a port, a simplified static file server is included:
1.  Make sure Node.js is installed on your machine.
2.  In the project root, run:
    ```bash
    npm install
    npm run dev
    ```
3.  Open `http://localhost:3000` in your web browser.

---

## How to Use the UI

### 1. Linking your `policy.json` File
*   At the top of the screen, you will see a yellow warning bar stating the app is unlinked.
*   Click the **Link policy.json** button.
*   Select the `policy.json` file on your computer (or from a shared network drive).
*   When prompted by your browser, click **View files** / **Save changes** to authorize read/write permissions.
*   The bar will turn green, indicating that the app is linked directly to your file.

### 2. Adding / Modifying Rules
*   In the **Configure Rule** card:
    *   **Extension ID / Scope**: Enter the ID of the browser extension (e.g., `uBlock0@raymondhill.net` or `{eddf1c58-948d-4e0e-9c42-e611e9050a97}`). Use `*` to configure the default global policy.
    *   **Installation Mode**: Choose **Allowed** or **Blocked**.
    *   **Custom Block Message**: If set to Blocked, you can add an optional explanation message that the browser will display to users if they try to install it.
*   Click **Save Configuration**. The rule is added/updated in the list and saved directly to your file.

### 3. Modifying & Deleting Rules
*   To **Edit** an existing rule, click the Edit icon (pencil) in the *Active Policies* table. The values will populate the configuration form.
*   To **Delete** a rule, click the Delete icon (trash can) in the *Active Policies* table and confirm the action.

### 4. Importing/Replacing Configuration
*   Click the **Import** button in the *Live JSON Preview* card header.
*   Either choose a `policy.json` file using the file uploader or paste a raw JSON string into the text field.
*   The system will automatically validate the syntax and schema. If valid, click **Apply & Save** to write it to your file.

### 5. Exporting & Copying
*   Click **Copy** in the preview card header to instantly copy the well-formatted JSON configuration to your clipboard.
*   Click **Download** to download a copy of the current policy structure as a local file.
*   Click **Reset** to restore the default 10 template rules.

---

## Browser Compatibility

*   **Recommended (Auto-Save Enabled)**: Google Chrome, Microsoft Edge, Opera, or any Chromium-based desktop browser.
*   **Unsupported for Auto-Save**: Firefox and Safari do not support the HTML5 File System Access API due to security designs. On these browsers, the app will hide the file link status bar and gracefully fall back to saving changes in browser memory. Users can still copy or download the modified files manually.
