# Browser Extension Policy Manager

A simple, fast, and token-free web dashboard designed to generate, format, and manage browser extension installation policies. Hosted locally on an internal server or VM, it uses a lightweight **Node.js/Express backend** to automatically read and write the `policy.json` configuration file in the project directory—requiring **no databases, no logins, and no passwords/tokens for your team**.

---

## Key Features

*   **Automatic File Management**: The server reads `policy.json` from the root directory on load and writes updates directly to it. Teammates do not need to select files or upload configs.
*   **Token-Free Editing**: All authentication, logins, and Personal Access Tokens (PATs) have been removed. Any teammate can open the link and edit the policies instantly.
*   **Live Formatted JSON Preview**: Real-time syntax-highlighted preview of the policies with a copy helper.
*   **Import & Validate**: Easily import existing `policy.json` files or paste raw JSON. The UI validates the schema before writing to the disk.
*   **Search & Filters**: Instantly filter active rules by Extension ID in the clean dark glassmorphism table.

---

## How to Run & Host

Since all files are located in the root folder, setting up the local server is simple:

1.  Make sure [Node.js](https://nodejs.org/) is installed on the hosting computer or VM.
2.  In the project root folder, run:
    ```bash
    npm install
    ```
3.  Start the server:
    ```bash
    npm start
    ```
4.  The server is now active on port 3000:
    *   **To access on the host computer**: Open `http://localhost:3000` in your web browser.
    *   **For your team to access**: Send them the link using the host computer's IP address (e.g. `http://[host-ip-address]:3000`).

---

## How to Use the UI

### 1. Adding / Modifying Rules
*   In the **Configure Rule** card:
    *   **Extension ID / Scope**: Enter the ID of the browser extension (e.g. `uBlock0@raymondhill.net` or `{eddf1c58-948d-4e0e-9c42-e611e9050a97}`). Use `*` to configure the default global policy.
    *   **Installation Mode**: Choose **Allowed** or **Blocked**.
    *   **Custom Block Message**: If set to Blocked, you can add an optional explanation message that the browser will display to users if they try to install it.
*   Click **Save Configuration**. The rule is added/updated in the list and saved directly to the server's `policy.json` file.

### 2. Deleting Rules
*   Click the Delete icon (trash can) next to any extension rule in the *Active Policies* table and confirm the action. The rule is immediately removed from the server's `policy.json` file.

### 3. Importing & Exporting
*   Click **Import** in the *Live JSON Preview* card header to paste raw JSON or upload a file. The app validates the formatting before writing.
*   Click **Copy** in the preview card header to instantly copy the well-formatted JSON to your clipboard.
*   Click **Download** to save the configuration as a local file.
*   Click **Reset** to restore the default 10 template rules.
