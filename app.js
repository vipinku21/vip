// Default policies matching the original policy.json file
const DEFAULT_POLICIES = {
  "*": {
    "installation_mode": "blocked",
    "blocked_install_message": "Add-ons for Firefox are not allowed and restricted by Administrator."
  },
  "default-theme@mozilla.org": {
    "installation_mode": "allowed"
  },
  "wikipedia@search.mozilla.org": {
    "installation_mode": "allowed"
  },
  "google@search.mozilla.org": {
    "installation_mode": "allowed"
  },
  "ddg@search.mozilla.org": {
    "installation_mode": "allowed"
  },
  "bing@search.mozilla.org": {
    "installation_mode": "allowed"
  },
  "uBlock0@raymondhill.net": {
    "installation_mode": "allowed"
  },
  "dmpgopmhgecgfpbiphgfobeaeaodaidj@58374f4c-bd5f-42b4-be93-6faf5a7f0833.com": {
    "installation_mode": "allowed"
  },
  "{eddf1c58-948d-4e0e-9c42-e611e9050a97}": {
    "installation_mode": "allowed"
  },
  "{d634138d-c276-4fc8-924b-40a0ea21d284}": {
    "installation_mode": "allowed"
  }
};

const STORAGE_KEY = 'browser_extension_policies';
const GITHUB_SETTINGS_KEY = 'github_policy_settings';

// State Management
let policyState = {};
let filterText = '';
let loadedFileSha = null;

// DOM Elements
const policyForm = document.getElementById('policy-form');
const extensionIdInput = document.getElementById('extension-id-input');
const installationModeSelect = document.getElementById('installation-mode-select');
const messageFieldGroup = document.getElementById('message-field-group');
const blockMessageInput = document.getElementById('block-message-input');
const saveRuleBtn = document.getElementById('save-rule-btn');

const jsonRenderBlock = document.getElementById('json-render-block');
const copyJsonBtn = document.getElementById('copy-json-btn');
const importJsonBtn = document.getElementById('import-json-btn');
const downloadJsonBtn = document.getElementById('download-json-btn');
const resetJsonBtn = document.getElementById('reset-json-btn');

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const rulesTableBody = document.getElementById('rules-table-body');

const statTotalCount = document.getElementById('stat-total-count');
const statAllowedCount = document.getElementById('stat-allowed-count');
const statBlockedCount = document.getElementById('stat-blocked-count');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toastWrapper = document.getElementById('toast-wrapper');

// GitHub / GitLab Settings DOM Elements
const githubTokenInput = document.getElementById('github-token-input');
const githubRepoInput = document.getElementById('github-repo-input');
const githubBranchInput = document.getElementById('github-branch-input');
const saveGithubBtn = document.getElementById('save-github-btn');
const githubFormContent = document.getElementById('github-form-content');
const githubConnectedContent = document.getElementById('github-connected-content');
const githubConnectionDetails = document.getElementById('github-connection-details');
const disconnectGithubBtn = document.getElementById('disconnect-github-btn');
const githubProviderSelect = document.getElementById('integration-provider-select');
const githubHostInput = document.getElementById('github-host-input');
const gitlabHostGroup = document.getElementById('gitlab-host-group');
const connectedProviderTitle = document.getElementById('connected-provider-title');

// Import Modal DOM Elements
const importModal = document.getElementById('import-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelImportBtn = document.getElementById('cancel-import-btn');
const applyImportBtn = document.getElementById('apply-import-btn');
const importTextarea = document.getElementById('import-textarea');
const fileUploadInput = document.getElementById('file-upload-input');
const fileNameDisplay = document.getElementById('file-name-display');
const importErrorMsg = document.getElementById('import-error-msg');

// ==========================================
// INITIAL SETUP & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadGithubSettings();
  initPolicyData();
  
  // Toggle Block Message box on change
  installationModeSelect.addEventListener('change', toggleMessageField);
  
  // Form submission
  policyForm.addEventListener('submit', handleFormSubmit);
  
  // Search filter
  searchInput.addEventListener('input', handleSearch);
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // Copy JSON action
  copyJsonBtn.addEventListener('click', copyRawJson);

  // File download and reset
  downloadJsonBtn.addEventListener('click', downloadPolicyJson);
  resetJsonBtn.addEventListener('click', handleResetPolicies);

  // GitHub Settings save & disconnect
  saveGithubBtn.addEventListener('click', handleSaveGithubSettings);
  disconnectGithubBtn.addEventListener('click', handleDisconnectGithub);
  githubProviderSelect.addEventListener('change', toggleHostField);

  // Modal Action Listeners
  importJsonBtn.addEventListener('click', openImportModal);
  closeModalBtn.addEventListener('click', closeImportModal);
  cancelImportBtn.addEventListener('click', closeImportModal);
  applyImportBtn.addEventListener('click', applyImportedJson);
  
  // Close modal on background click
  importModal.addEventListener('click', (e) => {
    if (e.target === importModal) {
      closeImportModal();
    }
  });

  // File Upload listener
  fileUploadInput.addEventListener('change', handleFileUpload);
});

// Helper to parse repo input and resolve to 'owner/repo'
function parseRepoInput(input) {
  let cleaned = input.trim();
  // Remove git@github.com: or git@gitlab.com: prefix
  cleaned = cleaned.replace(/^git@(github|gitlab)\.com:/i, '');
  // Remove https://github.com/ or https://gitlab.com/ prefix
  cleaned = cleaned.replace(/^(https?:\/\/)?(www\.)?(github|gitlab)\.com\//i, '');
  // Remove .git suffix
  cleaned = cleaned.replace(/\.git$/i, '');
  // Remove leading/trailing slashes
  cleaned = cleaned.replace(/^\/+|\/+$/g, '');
  return cleaned;
}

// Helper to sanitize token input (strip prefixes if pasted by accident)
function parseTokenInput(input) {
  let cleaned = input.trim();
  // Remove "Bearer " or "token " prefix (case-insensitive)
  cleaned = cleaned.replace(/^(bearer|token)\s+/i, '');
  return cleaned;
}

// Toggle GitLab Instance URL field visibility
function toggleHostField() {
  if (githubProviderSelect.value === 'gitlab') {
    gitlabHostGroup.style.display = 'block';
  } else {
    gitlabHostGroup.style.display = 'none';
  }
}

// Load Git settings from localStorage on load
function loadGithubSettings() {
  try {
    const settingsStr = localStorage.getItem(GITHUB_SETTINGS_KEY);
    if (settingsStr) {
      const settings = JSON.parse(settingsStr);
      githubProviderSelect.value = settings.provider || 'github';
      githubTokenInput.value = settings.token || '';
      githubRepoInput.value = settings.repo || 'vipinku21/vip';
      githubBranchInput.value = settings.branch || 'main';
      githubHostInput.value = settings.host || 'https://gitlab.com';
    } else {
      githubProviderSelect.value = 'github';
      githubRepoInput.value = 'vipinku21/vip';
      githubBranchInput.value = 'main';
      githubHostInput.value = 'https://gitlab.com';
    }
    toggleHostField();
  } catch (err) {
    console.error("Error loading Git settings:", err);
  }
}

// Get current active Git settings and update UI with sanitized inputs
function getGithubConfig() {
  const provider = githubProviderSelect.value;
  const rawToken = githubTokenInput.value.trim();
  const rawRepo = githubRepoInput.value.trim();
  const host = githubHostInput.value.trim();
  
  const token = parseTokenInput(rawToken);
  const repo = parseRepoInput(rawRepo);
  const branch = githubBranchInput.value.trim();
  
  // Feed cleaned values back to UI inputs so the user sees the sanitized form
  if (githubTokenInput.value !== token) githubTokenInput.value = token;
  if (githubRepoInput.value !== repo) githubRepoInput.value = repo;
  if (githubHostInput.value !== host) githubHostInput.value = host;
  
  return { provider, token, repo, branch, host };
}

// Initialize policy data automatically
async function initPolicyData() {
  const config = getGithubConfig();
  
  // If we have a token, pull the absolute latest from the Git API
  if (config.token && config.repo) {
    statusDot.className = 'status-indicator-dot github';
    statusText.textContent = `Connected to ${config.provider === 'gitlab' ? 'GitLab' : 'GitHub'} (${config.repo})`;
    
    const loaded = await loadFromGit(config);
    if (loaded) {
      updateGithubUIState(true);
      return;
    }
  }
  
  updateGithubUIState(false);
  
  // Fallback 1: Fetch ./policy.json relative from the website folder
  try {
    const response = await fetch('./policy.json');
    if (response.ok) {
      policyState = await response.json();
      updateDashboard();
      showToast('Loaded active policy.json from directory.');
      
      if (!config.token) {
        statusDot.className = 'status-indicator-dot online';
        statusText.textContent = 'Viewing Static policy.json';
      }
      return;
    }
  } catch (err) {
    console.warn("Could not load local policy.json file:", err);
  }

  // Fallback 2: Load from local storage
  try {
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      policyState = JSON.parse(storedData);
      showToast('Loaded policy from browser backup storage.');
    } else {
      policyState = { ...DEFAULT_POLICIES };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(policyState));
      showToast('Initialized default templates.');
    }
  } catch (err) {
    policyState = { ...DEFAULT_POLICIES };
  }
  
  if (!config.token) {
    statusDot.className = 'status-indicator-dot unlinked';
    statusText.textContent = 'Awaiting Git Settings';
  }
  
  updateDashboard();
}

// Fetch policy.json from the Git API (GitHub / GitLab)
async function loadFromGit(config) {
  const isGitLab = config.provider === 'gitlab';
  const baseUrl = isGitLab ? `${config.host || 'https://gitlab.com'}/api/v4` : 'https://api.github.com';
  const repoPath = isGitLab ? encodeURIComponent(config.repo) : config.repo;
  
  const fetchUrl = isGitLab 
    ? `${baseUrl}/projects/${repoPath}/repository/files/policy.json?ref=${config.branch}`
    : `${baseUrl}/repos/${repoPath}/contents/policy.json?ref=${config.branch}`;
    
  const headers = {};
  if (isGitLab) {
    headers['PRIVATE-TOKEN'] = config.token;
  } else {
    headers['Authorization'] = `Bearer ${config.token}`;
    headers['Accept'] = 'application/vnd.github.v3+json';
  }

  try {
    const res = await fetch(fetchUrl, { headers });

    if (res.ok) {
      const fileInfo = await res.json();
      // Decode base64
      const decodedContent = decodeURIComponent(escape(atob(fileInfo.content.replace(/\s/g, ''))));
      policyState = JSON.parse(decodedContent);
      loadedFileSha = isGitLab ? fileInfo.last_commit_id : fileInfo.sha; // Track the current file version SHA
      updateDashboard();
      showToast(`Successfully fetched latest policy.json from ${isGitLab ? 'GitLab' : 'GitHub'}.`);
      return true;
    } else if (res.status === 401) {
      showToast(`Unauthorized: ${isGitLab ? 'GitLab' : 'GitHub'} token is invalid or expired.`, 'error');
    } else if (res.status === 403) {
      showToast(`Access forbidden: Check token scopes/permissions or API limits.`, 'error');
    } else if (res.status === 404) {
      showToast('policy.json not found in repository. Using template rules.', 'error');
    } else {
      showToast(`${isGitLab ? 'GitLab' : 'GitHub'} API returned error code ${res.status}`, 'error');
    }
  } catch (err) {
    console.error(`Error loading from ${isGitLab ? 'GitLab' : 'GitHub'}:`, err);
    showToast(`Failed to connect to Git API: ${err.message || err}`, 'error');
  }
  return false;
}

// Save policies to Git repository (or LocalStorage backup if unlinked)
async function savePolicyData() {
  const config = getGithubConfig();
  
  // If no token is set, save to LocalStorage fallback
  if (!config.token || !config.repo) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(policyState, null, 2));
      showToast('No active Git connection. Saved in browser memory.');
    } catch (e) {
      console.error(e);
    }
    return;
  }

  const isGitLab = config.provider === 'gitlab';
  const baseUrl = isGitLab ? `${config.host || 'https://gitlab.com'}/api/v4` : 'https://api.github.com';
  const repoPath = isGitLab ? encodeURIComponent(config.repo) : config.repo;

  try {
    saveRuleBtn.disabled = true;
    const saveBtnLabel = saveRuleBtn.querySelector('span');
    const originalLabel = saveBtnLabel.textContent;
    saveBtnLabel.textContent = `Pushing to ${isGitLab ? 'GitLab' : 'GitHub'}...`;

    // 1. Fetch the file SHA/commit_id first (required to check conflicts)
    let currentSha = null;
    try {
      const getFileUrl = isGitLab
        ? `${baseUrl}/projects/${repoPath}/repository/files/policy.json?ref=${config.branch}`
        : `${baseUrl}/repos/${repoPath}/contents/policy.json?ref=${config.branch}`;
        
      const getHeaders = {};
      if (isGitLab) {
        getHeaders['PRIVATE-TOKEN'] = config.token;
      } else {
        getHeaders['Authorization'] = `Bearer ${config.token}`;
        getHeaders['Accept'] = 'application/vnd.github.v3+json';
      }

      const getFileRes = await fetch(getFileUrl, { headers: getHeaders });
      if (getFileRes.ok) {
        const fileInfo = await getFileRes.json();
        currentSha = isGitLab ? fileInfo.last_commit_id : fileInfo.sha;
      }
    } catch (e) {
      console.warn("Could not fetch file version info (might be creating new file):", e);
    }

    // Version Conflict Detection: Compare current remote version with loadedFileSha
    if (loadedFileSha && currentSha && currentSha !== loadedFileSha) {
      showToast('Save Blocked: Another teammate has updated the policies in the repository. Please reload the page to get their latest updates before saving your changes.', 'error');
      saveRuleBtn.disabled = false;
      saveBtnLabel.textContent = originalLabel;
      return;
    }

    // 2. Prepare base64 payload
    const jsonStr = JSON.stringify(policyState, null, 2);
    const base64Content = btoa(unescape(encodeURIComponent(jsonStr)));

    // 3. Commit back to Git provider
    let commitUrl, method, commitHeaders, commitBody;
    
    if (isGitLab) {
      commitUrl = `${baseUrl}/projects/${repoPath}/repository/files/policy.json`;
      method = 'PUT';
      commitHeaders = {
        'PRIVATE-TOKEN': config.token,
        'Content-Type': 'application/json'
      };
      commitBody = {
        branch: config.branch,
        commit_message: 'Update policy.json via Web Editor',
        content: base64Content,
        encoding: 'base64'
      };
      if (currentSha) {
        commitBody.last_commit_id = currentSha;
      }
    } else {
      commitUrl = `${baseUrl}/repos/${repoPath}/contents/policy.json`;
      method = 'PUT';
      commitHeaders = {
        'Authorization': `Bearer ${config.token}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      };
      commitBody = {
        message: 'Update policy.json via Web Editor',
        content: base64Content,
        branch: config.branch
      };
      if (currentSha) {
        commitBody.sha = currentSha;
      }
    }

    const pushRes = await fetch(commitUrl, {
      method: method,
      headers: commitHeaders,
      body: JSON.stringify(commitBody)
    });

    if (pushRes.ok) {
      const pushData = await pushRes.json();
      // Update our loaded file SHA version from response to prevent future false conflicts
      loadedFileSha = isGitLab ? pushData.last_commit_id : pushData.content.sha;
      showToast(`Successfully committed changes directly to ${isGitLab ? 'GitLab' : 'GitHub'}!`);
      
      // Also backup locally just in case
      localStorage.setItem(STORAGE_KEY, jsonStr);
    } else {
      let errMsg = 'Git push failed';
      try {
        const errData = await pushRes.json();
        errMsg = errData.message || errMsg;
      } catch (jsonErr) {}
      
      if (pushRes.status === 401) {
        throw new Error('Unauthorized: Invalid or expired Git token.');
      } else if (pushRes.status === 403) {
        throw new Error('Forbidden: Lacking write permissions or rate-limited.');
      } else if (pushRes.status === 404) {
        throw new Error('Repository, branch, or file not found.');
      } else {
        throw new Error(`${errMsg} (Status: ${pushRes.status})`);
      }
    }

    saveRuleBtn.disabled = false;
    saveBtnLabel.textContent = originalLabel;
  } catch (err) {
    console.error("Git Commit Error:", err);
    showToast(`Failed to update Git repository: ${err.message}`, 'error');
    saveRuleBtn.disabled = false;
    saveRuleBtn.querySelector('span').textContent = 'Save Configuration';
  }
}

// Handle Git integration settings validation and save
async function handleSaveGithubSettings() {
  const config = getGithubConfig();
  const isGitLab = config.provider === 'gitlab';
  const baseUrl = isGitLab ? `${config.host || 'https://gitlab.com'}/api/v4` : 'https://api.github.com';
  const repoPath = isGitLab ? encodeURIComponent(config.repo) : config.repo;

  if (!config.token) {
    showToast('Please enter an Access Token.', 'error');
    return;
  }
  if (!config.repo || !config.repo.includes('/')) {
    showToast('Please enter a valid Repository / Project Path (e.g. owner/repo).', 'error');
    return;
  }

  try {
    saveGithubBtn.disabled = true;
    saveGithubBtn.querySelector('span').textContent = 'Verifying connection...';

    // Verify token permissions by loading the repo properties
    const fetchUrl = isGitLab 
      ? `${baseUrl}/projects/${repoPath}`
      : `${baseUrl}/repos/${repoPath}`;
      
    const headers = {};
    if (isGitLab) {
      headers['PRIVATE-TOKEN'] = config.token;
    } else {
      headers['Authorization'] = `Bearer ${config.token}`;
      headers['Accept'] = 'application/vnd.github.v3+json';
    }

    const res = await fetch(fetchUrl, { headers });

    if (res.ok) {
      const repoInfo = await res.json();
      
      // Verify if the token actually has push (write) permissions to this repository
      let hasPushAccess = false;
      if (isGitLab) {
        const projAccess = repoInfo.permissions && repoInfo.permissions.project_access;
        const groupAccess = repoInfo.permissions && repoInfo.permissions.group_access;
        const accessLevel = Math.max(
          (projAccess && projAccess.access_level) || 0,
          (groupAccess && groupAccess.access_level) || 0
        );
        // Developer role has access_level >= 30, Maintainer has >= 40
        if (repoInfo.permissions) {
          hasPushAccess = accessLevel >= 30;
        } else {
          hasPushAccess = true; // Fallback: public project metadata returns ok but no permissions block
        }
      } else {
        hasPushAccess = repoInfo.permissions && repoInfo.permissions.push;
      }
      
      if (!hasPushAccess) {
        showToast(`Verification failed: Your token is valid, but it lacks WRITE permissions. For GitLab, ensure your token has "api" scope. For GitHub, ensure "repo" or "Contents: Read & Write" is checked.`, 'error');
        return;
      }

      // Check for OAuth scopes for classic tokens to warn the user if repo scope is missing (GitHub only)
      let scopeWarning = '';
      if (!isGitLab) {
        const scopes = res.headers.get('X-OAuth-Scopes');
        if (scopes !== null) {
          const scopeArray = scopes.split(',').map(s => s.trim());
          if (!scopeArray.includes('repo')) {
            scopeWarning = 'Warning: Token is missing the "repo" scope needed to edit files.';
          }
        }
      }

      // Save settings to localStorage
      localStorage.setItem(GITHUB_SETTINGS_KEY, JSON.stringify(config));
      
      if (scopeWarning) {
        showToast(`Connected, but authorization warning: ${scopeWarning}`, 'error');
      } else {
        showToast(`Git credentials verified! Connected successfully to ${isGitLab ? 'GitLab' : 'GitHub'} with write access.`, 'success');
      }
      
      statusDot.className = 'status-indicator-dot github';
      statusText.textContent = `Connected to ${isGitLab ? 'GitLab' : 'GitHub'} (${config.repo})`;
      
      // Refresh policy.json values
      await loadFromGit(config);
      updateGithubUIState(true);
    } else {
      let errMsg = 'Invalid Token or Repository';
      try {
        const errInfo = await res.json();
        errMsg = errInfo.message || errInfo.error || errMsg;
      } catch (jsonErr) {}
      
      let hint = '';
      if (res.status === 401) {
        hint = `Bad Credentials: Check that your token is typed correctly, not expired, and has ${isGitLab ? 'api' : 'repo'} scope.`;
      } else if (res.status === 404) {
        hint = `Not Found: Verify the project path and instance URL are correct. If private, verify your token has access.`;
      } else if (res.status === 403) {
        hint = `Forbidden: Access blocked. You might have hit rate limits or the token lacks permission.`;
      } else {
        hint = `Error code: ${res.status}`;
      }
      
      showToast(`Verification Failed: ${errMsg}. ${hint}`, 'error');
    }
  } catch (err) {
    console.error(err);
    showToast(`Network error: ${err.message || err}`, 'error');
  } finally {
    saveGithubBtn.disabled = false;
    saveGithubBtn.querySelector('span').textContent = 'Save & Verify Connection';
  }
}

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let iconSvg = '';
  if (type === 'success') {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
  } else {
    iconSvg = `<svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
  }
  
  toast.innerHTML = `
    ${iconSvg}
    <span class="toast-message">${message}</span>
  `;
  
  toastWrapper.appendChild(toast);
  
  setTimeout(() => {
    toast.remove();
  }, 4000);
}

// Show/Hide blocked message textarea dynamically
function toggleMessageField() {
  if (installationModeSelect.value === 'blocked') {
    messageFieldGroup.classList.add('visible');
  } else {
    messageFieldGroup.classList.remove('visible');
    blockMessageInput.value = ''; // Reset message value
  }
}

// Format and style JSON object with CSS classes
function highlightJson(jsonObj) {
  const jsonString = JSON.stringify(jsonObj, null, 2);
  
  return jsonString.replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g, function (match) {
    let cls = 'json-number';
    if (/^"/.test(match)) {
      if (/:$/.test(match)) {
        cls = 'json-key';
      } else {
        cls = 'json-string';
      }
    } else if (/true|false/.test(match)) {
      cls = 'json-boolean';
    } else if (/null/.test(match)) {
      cls = 'json-null';
    }
    
    if (cls === 'json-key') {
      return `<span class="${cls}">${match.replace(/:$/, '')}</span>:`;
    } else {
      return `<span class="${cls}">${match}</span>`;
    }
  });
}

// Update the full layout dashboard components
function updateDashboard() {
  const keys = Object.keys(policyState);
  const total = keys.length;
  let allowed = 0;
  let blocked = 0;
  
  keys.forEach(key => {
    if (policyState[key] && policyState[key].installation_mode === 'allowed') {
      allowed++;
    } else {
      blocked++;
    }
  });
  
  statTotalCount.textContent = total;
  statAllowedCount.textContent = allowed;
  statBlockedCount.textContent = blocked;
  
  jsonRenderBlock.innerHTML = highlightJson(policyState);
  renderTable();
}

// Render active policy entries in the table
function renderTable() {
  const keys = Object.keys(policyState);
  const filteredKeys = keys.filter(key => 
    key.toLowerCase().includes(filterText.toLowerCase())
  );
  
  if (filteredKeys.length === 0) {
    if (filterText) {
      renderEmptyState(`No rules found matching "${filterText}"`);
    } else {
      renderEmptyState('No policies configured. Use the form to add one!');
    }
    return;
  }
  
  rulesTableBody.innerHTML = '';
  
  filteredKeys.forEach(id => {
    const policy = policyState[id];
    const isAllowed = policy.installation_mode === 'allowed';
    
    const row = document.createElement('tr');
    
    const idCell = document.createElement('td');
    idCell.className = 'extension-id-cell';
    idCell.title = 'Click to copy ID';
    idCell.innerHTML = `
      <span class="copyable-id" onclick="copyText('${id}')">${id}</span>
    `;
    
    const statusCell = document.createElement('td');
    const badgeClass = isAllowed ? 'badge badge-allowed' : 'badge badge-blocked';
    const messageTooltip = policy.blocked_install_message ? ` title="${policy.blocked_install_message}"` : '';
    statusCell.innerHTML = `
      <span class="${badgeClass}"${messageTooltip}>
        <span class="badge-dot"></span>
        ${policy.installation_mode}
      </span>
    `;
    
    const actionsCell = document.createElement('td');
    actionsCell.className = 'action-buttons-cell text-right';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-action';
    editBtn.title = 'Edit configuration';
    editBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
      </svg>
    `;
    editBtn.onclick = () => fillFormForEdit(id, policy);
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'btn-action btn-action-delete';
    deleteBtn.title = 'Delete policy';
    deleteBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
    `;
    deleteBtn.onclick = () => deletePolicy(id);
    
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(deleteBtn);
    
    row.appendChild(idCell);
    row.appendChild(statusCell);
    row.appendChild(actionsCell);
    
    rulesTableBody.appendChild(row);
  });
}

// Render empty or error layout in Table
function renderEmptyState(message) {
  rulesTableBody.innerHTML = `
    <tr class="empty-state-row">
      <td colspan="3">
        <div class="empty-state-wrapper">
          <p>${message}</p>
        </div>
      </td>
    </tr>
  `;
}

// Copy raw text to clipboard (helper)
window.copyText = function(text) {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`Copied "${text}" to clipboard!`);
  }).catch(err => {
    console.error('Failed to copy text:', err);
    showToast('Failed to copy to clipboard', 'error');
  });
};

// Copy raw JSON configuration
function copyRawJson() {
  const jsonStr = JSON.stringify(policyState, null, 2);
  navigator.clipboard.writeText(jsonStr).then(() => {
    showToast('JSON Configuration copied to clipboard!');
    
    const originalContent = copyJsonBtn.innerHTML;
    copyJsonBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
      <span>Copied!</span>
    `;
    copyJsonBtn.style.borderColor = 'var(--color-success)';
    copyJsonBtn.style.color = 'var(--color-success)';
    
    setTimeout(() => {
      copyJsonBtn.innerHTML = originalContent;
      copyJsonBtn.style.borderColor = '';
      copyJsonBtn.style.color = '';
    }, 2000);
  }).catch(err => {
    console.error('Failed to copy JSON:', err);
    showToast('Failed to copy JSON configuration.', 'error');
  });
}

// Download formatted policy.json file
function downloadPolicyJson() {
  try {
    const dataStr = JSON.stringify(policyState, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.href = url;
    downloadAnchor.download = 'policy.json';
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    
    document.body.removeChild(downloadAnchor);
    URL.revokeObjectURL(url);
    
    showToast('policy.json downloaded successfully!');
  } catch (error) {
    console.error('Error downloading file:', error);
    showToast('Failed to export policy file.', 'error');
  }
}

// Reset rules to the pre-packaged setup or reload policy.json from the repository
async function handleResetPolicies() {
  if (confirm('Are you sure you want to reset all custom edits and reload the original policy.json file from the repository?')) {
    try {
      const response = await fetch('./policy.json');
      if (response.ok) {
        policyState = await response.json();
        savePolicyData();
        updateDashboard();
        showToast('Reset configuration to the repository file.');
      } else {
        throw new Error();
      }
    } catch (e) {
      policyState = { ...DEFAULT_POLICIES };
      savePolicyData();
      updateDashboard();
      showToast('Reverted configuration to default templates.');
    }
  }
}

// Open the Import modal overlay
function openImportModal() {
  importTextarea.value = JSON.stringify(policyState, null, 2);
  fileUploadInput.value = '';
  fileNameDisplay.textContent = 'No file chosen';
  importErrorMsg.textContent = '';
  importErrorMsg.classList.add('hidden');
  importModal.classList.add('active');
  importTextarea.focus();
}

// Close the Import modal overlay
function closeImportModal() {
  importModal.classList.remove('active');
}

// Handle File upload inside the Import modal
function handleFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;

  fileNameDisplay.textContent = file.name;
  importErrorMsg.classList.add('hidden');
  
  const reader = new FileReader();
  reader.onload = function(evt) {
    importTextarea.value = evt.target.result;
  };
  reader.onerror = function() {
    importErrorMsg.textContent = 'Failed to read uploaded file.';
    importErrorMsg.classList.remove('hidden');
  };
  reader.readAsText(file);
}

// Validate and apply imported JSON configuration
async function applyImportedJson() {
  const inputStr = importTextarea.value.trim();
  
  if (!inputStr) {
    importErrorMsg.textContent = 'JSON code area cannot be empty.';
    importErrorMsg.classList.remove('hidden');
    return;
  }
  
  try {
    const parsedData = JSON.parse(inputStr);
    
    if (typeof parsedData !== 'object' || parsedData === null || Array.isArray(parsedData)) {
      throw new Error('Root level element must be a valid JSON Object.');
    }
    
    for (const key in parsedData) {
      const config = parsedData[key];
      if (typeof config !== 'object' || config === null) {
        throw new Error(`Rule for key "${key}" must be an object.`);
      }
      
      const mode = config.installation_mode;
      if (mode !== 'allowed' && mode !== 'blocked') {
        throw new Error(`Rule "${key}" has invalid installation_mode. Must be "allowed" or "blocked".`);
      }
      
      if (config.blocked_install_message && typeof config.blocked_install_message !== 'string') {
        throw new Error(`Rule "${key}" has an invalid blocked_install_message (must be string).`);
      }
    }
    
    policyState = parsedData;
    await savePolicyData();
    updateDashboard();
    
    closeImportModal();
    showToast('Import completed successfully!');
  } catch (err) {
    importErrorMsg.textContent = `JSON Syntax Error:\n${err.message}`;
    importErrorMsg.classList.remove('hidden');
  }
}

// Fill Form inputs with details for Edit
function fillFormForEdit(id, policy) {
  extensionIdInput.value = id;
  installationModeSelect.value = policy.installation_mode;
  
  if (policy.installation_mode === 'blocked') {
    messageFieldGroup.classList.add('visible');
    blockMessageInput.value = policy.blocked_install_message || '';
  } else {
    messageFieldGroup.classList.remove('visible');
    blockMessageInput.value = '';
  }
  
  policyForm.closest('.card').style.boxShadow = '0 0 20px var(--color-primary-glow)';
  setTimeout(() => {
    policyForm.closest('.card').style.boxShadow = '';
  }, 1000);
  
  extensionIdInput.focus();
}

// Handle Form Submission (Save/Update rule)
async function handleFormSubmit(e) {
  e.preventDefault();
  
  const id = extensionIdInput.value.trim();
  const installation_mode = installationModeSelect.value;
  const blocked_install_message = blockMessageInput.value.trim();
  
  if (!id) {
    showToast('Please enter an Extension ID.', 'error');
    extensionIdInput.focus();
    return;
  }
  
  const config = {
    installation_mode
  };
  
  if (installation_mode === 'blocked' && blocked_install_message) {
    config.blocked_install_message = blocked_install_message;
  }
  
  policyState[id] = config;
  
  await savePolicyData();
  updateDashboard();
  
  policyForm.reset();
  messageFieldGroup.classList.remove('visible');
  
  showToast(`Saved configuration for "${id}" successfully.`);
}

// Delete Policy from memory
async function deletePolicy(id) {
  if (!confirm(`Are you sure you want to delete the configuration for "${id}"?`)) {
    return;
  }
  
  if (id in policyState) {
    delete policyState[id];
    await savePolicyData();
    updateDashboard();
    showToast(`Policy for "${id}" removed successfully.`);
  } else {
    showToast(`Policy for "${id}" not found in current configuration.`, 'error');
  }
}

// Live Search Filter Handler
function handleSearch(e) {
  filterText = e.target.value;
  
  if (filterText) {
    clearSearchBtn.classList.remove('hidden');
  } else {
    clearSearchBtn.classList.add('hidden');
  }
  
  renderTable();
}

// Clear Search input
function clearSearch() {
  searchInput.value = '';
  filterText = '';
  clearSearchBtn.classList.add('hidden');
  renderTable();
}

// Update the GitHub UI card state based on connection
function updateGithubUIState(connected) {
  const config = getGithubConfig();
  if (connected && config.token && config.repo) {
    githubFormContent.style.display = 'none';
    githubConnectedContent.style.display = 'flex';
    connectedProviderTitle.textContent = `Connected to ${config.provider === 'gitlab' ? 'GitLab' : 'GitHub'}`;
    githubConnectionDetails.innerHTML = `Repository: <strong>${config.repo}</strong><br>Branch: <strong>${config.branch}</strong>`;
  } else {
    githubFormContent.style.display = 'flex';
    githubConnectedContent.style.display = 'none';
  }
}

// Disconnect Git and clear localStorage credentials
function handleDisconnectGithub() {
  if (confirm('Are you sure you want to disconnect your Git integration? This will remove the token from your browser memory.')) {
    localStorage.removeItem(GITHUB_SETTINGS_KEY);
    githubProviderSelect.value = 'github';
    githubTokenInput.value = '';
    githubRepoInput.value = 'vipinku21/vip';
    githubBranchInput.value = 'main';
    githubHostInput.value = 'https://gitlab.com';
    loadedFileSha = null;
    updateGithubUIState(false);
    
    statusDot.className = 'status-indicator-dot unlinked';
    statusText.textContent = 'Awaiting Git Settings';
    
    // Reload local/fallback policy rules
    initPolicyData();
  }
}
