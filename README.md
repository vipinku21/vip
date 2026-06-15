# Browser Extension Policy Manager

A modern, high-performance, serverless dashboard designed to generate, format, and manage browser extension installation policies. Hosted directly on **GitHub Pages**, it uses the **GitHub REST API** to load and save updates directly to the `policy.json` file in your repository—requiring **no local databases, no local servers, and no VS Code installations** for your team.

---

## Key Features

*   **Zero-Selection File Loader**: On page startup, the app automatically reads the `policy.json` file in your repository. No manual file linking or file picking is required.
*   **Direct GitHub Commits (Auto-Save)**: When authorized, any configuration changes (add, edit, delete, reset) are committed directly back to the `policy.json` file in your repository.
*   **Token Persistence**: Saves your GitHub Personal Access Token (PAT) securely inside your own browser's `localStorage` so you only have to enter it once.
*   **Live Formatted JSON Preview**: Real-time syntax-highlighted preview of the policies with a one-click copy helper.
*   **Import & Validate**: Easily import existing policy JSON files or paste raw JSON with strict schema validation before committing.
*   **Search & Filters**: Instantly search active rules by Extension ID in the clean dark glassmorphism table.

---

## How to Run

### Option A: Use the Shared Web Link (Recommended)
Simply open your published GitHub Pages URL (e.g. `https://vipinku21.github.io/vip/`) in Google Chrome or Microsoft Edge. Any teammate can access this link instantly.

### Option B: Run Locally
If you prefer running a local preview of the files:
1.  Make sure Node.js is installed on your computer.
2.  In the project root, run:
    ```bash
    npm start
    ```
3.  Open `http://localhost:8080` in your web browser.

---

## How to Use the UI

### 1. Connecting to your GitHub Repository
*   When you first load the page, you can publicly **view** the active rules without logging in.
*   To **edit** rules, paste your **GitHub Personal Access Token (PAT)** (which requires `repo` write permissions) in the *GitHub Integration* card.
*   Click **Save & Verify Connection**. Once verified, the status indicator in the top-right will turn blue/cyan and display *"Connected to GitHub"*.

### 2. Adding / Modifying Rules
*   In the **Configure Rule** card:
    *   **Extension ID / Scope**: Enter the ID of the browser extension (e.g. `uBlock0@raymondhill.net` or `{eddf1c58-948d-4e0e-9c42-e611e9050a97}`). Use `*` to configure the default global policy.
    *   **Installation Mode**: Choose **Allowed** or **Blocked**.
    *   **Custom Block Message**: If set to Blocked, you can add an optional explanation message that the browser will display to users if they try to install it.
*   Click **Save Configuration**. The rule is added/updated in the list and committed directly to GitHub.

### 3. Deleting Rules
*   Click the Delete icon (trash can) next to any extension rule in the *Active Policies* table and confirm the action. The change is committed directly to GitHub.

### 4. Importing & Exporting
*   Click **Import** in the *Live JSON Preview* card header to paste raw JSON or upload a file. The app validates the formatting before committing.
*   Click **Copy** in the preview card header to instantly copy the well-formatted JSON to your clipboard.
*   Click **Download** to save the configuration as a local file.
*   Click **Reset** to restore the default 10 template rules.
