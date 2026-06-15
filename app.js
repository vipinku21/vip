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

// State Management
let policyState = {};
let filterText = '';

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

// Initialize policy data automatically from local policy.json or localStorage backup
async function initPolicyData() {
  try {
    // If the user already made edits in their browser, load those
    const storedData = localStorage.getItem(STORAGE_KEY);
    if (storedData) {
      policyState = JSON.parse(storedData);
      showToast('Loaded saved configuration from browser storage.');
      setConnectionStatus(true);
      updateDashboard();
      return;
    }

    // Otherwise, fetch the default policy.json from the repository
    const response = await fetch('./policy.json');
    if (response.ok) {
      policyState = await response.json();
      savePolicyData();
      showToast('Loaded active policy.json file.');
      setConnectionStatus(true);
    } else {
      throw new Error('Could not find policy.json file');
    }
  } catch (err) {
    console.warn("Failed to load policy.json. Falling back to templates:", err);
    policyState = { ...DEFAULT_POLICIES };
    savePolicyData();
    setConnectionStatus(true);
  }
  updateDashboard();
}

// Save policies to browser localStorage
function savePolicyData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(policyState, null, 2));
  } catch (e) {
    console.error('Failed to save to localStorage:', e);
  }
}

// Set UI status indicator state
function setConnectionStatus(ok) {
  if (ok) {
    statusDot.className = 'status-indicator-dot online';
    statusText.textContent = 'Active (Serverless)';
  } else {
    statusDot.className = 'status-indicator-dot offline';
    statusText.textContent = 'Error Loading file';
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
    savePolicyData();
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
  
  savePolicyData();
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
    savePolicyData();
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
