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

const searchInput = document.getElementById('search-input');
const clearSearchBtn = document.getElementById('clear-search-btn');
const rulesTableBody = document.getElementById('rules-table-body');

const statTotalCount = document.getElementById('stat-total-count');
const statAllowedCount = document.getElementById('stat-allowed-count');
const statBlockedCount = document.getElementById('stat-blocked-count');

const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const toastWrapper = document.getElementById('toast-wrapper');

// Initial Setup & Event Listeners
document.addEventListener('DOMContentLoaded', () => {
  fetchPolicies();
  
  // Toggle Block Message box on change
  installationModeSelect.addEventListener('change', toggleMessageField);
  
  // Form submission
  policyForm.addEventListener('submit', handleFormSubmit);
  
  // Search filter
  searchInput.addEventListener('input', handleSearch);
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // Copy JSON action
  copyJsonBtn.addEventListener('click', copyRawJson);
});

// Toast notification helper
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  // Icon based on type
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
  
  // Remove toast from DOM after animation completes (4s total)
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

// Set API Connection Status indicators
function setConnectionStatus(online) {
  if (online) {
    statusDot.className = 'status-indicator-dot online';
    statusText.textContent = 'Connected to API';
  } else {
    statusDot.className = 'status-indicator-dot offline';
    statusText.textContent = 'Disconnected / Offline';
  }
}

// Fetch Policies from Backend
async function fetchPolicies() {
  try {
    const response = await fetch('/api/policy');
    if (!response.ok) {
      throw new Error('API server returned an error');
    }
    policyState = await response.json();
    setConnectionStatus(true);
    updateDashboard();
  } catch (error) {
    console.error('Error fetching policies:', error);
    setConnectionStatus(false);
    showToast('Failed to fetch policies. Server may be offline.', 'error');
    renderEmptyState('Failed to connect to backend server. Make sure server is running.');
  }
}

// Format and style JSON object with CSS classes
function highlightJson(jsonObj) {
  const jsonString = JSON.stringify(jsonObj, null, 2);
  
  // Regex to match JSON parts
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
  // Update numbers
  const keys = Object.keys(policyState);
  const total = keys.length;
  let allowed = 0;
  let blocked = 0;
  
  keys.forEach(key => {
    if (policyState[key].installation_mode === 'allowed') {
      allowed++;
    } else {
      blocked++;
    }
  });
  
  statTotalCount.textContent = total;
  statAllowedCount.textContent = allowed;
  statBlockedCount.textContent = blocked;
  
  // Render syntax JSON
  jsonRenderBlock.innerHTML = highlightJson(policyState);
  
  // Render search results / table items
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
    
    // Extension ID cell (with click copy action)
    const idCell = document.createElement('td');
    idCell.className = 'extension-id-cell';
    idCell.title = 'Click to copy ID';
    idCell.innerHTML = `
      <span class="copyable-id" onclick="copyText('${id}')">${id}</span>
    `;
    
    // Status Badge Cell
    const statusCell = document.createElement('td');
    const badgeClass = isAllowed ? 'badge badge-allowed' : 'badge badge-blocked';
    const messageTooltip = policy.blocked_install_message ? ` title="${policy.blocked_install_message}"` : '';
    statusCell.innerHTML = `
      <span class="${badgeClass}"${messageTooltip}>
        <span class="badge-dot"></span>
        ${policy.installation_mode}
      </span>
    `;
    
    // Actions Cell (Edit + Delete)
    const actionsCell = document.createElement('td');
    actionsCell.className = 'action-buttons-cell text-right';
    
    // Edit Action Button
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
    
    // Delete Action Button
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
    
    // Toggle copy button UI success temporarily
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
  
  // Highlight Form
  policyForm.closest('.card').style.boxShadow = '0 0 20px var(--color-primary-glow)';
  setTimeout(() => {
    policyForm.closest('.card').style.boxShadow = '';
  }, 1000);
  
  extensionIdInput.focus();
}

// Handle Form Submission
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
  
  // Prepare payload
  const payload = {
    id,
    installation_mode
  };
  
  if (installation_mode === 'blocked' && blocked_install_message) {
    payload.blocked_install_message = blocked_install_message;
  }
  
  try {
    saveRuleBtn.disabled = true;
    saveRuleBtn.querySelector('span').textContent = 'Saving...';
    
    const response = await fetch('/api/policy', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Server error occurred');
    }
    
    showToast(result.message || 'Policy saved successfully.');
    
    // Update local state and UI
    policyState = result.data;
    updateDashboard();
    
    // Reset Form fields
    policyForm.reset();
    messageFieldGroup.classList.remove('visible');
    
  } catch (error) {
    console.error('Error saving policy:', error);
    showToast(error.message || 'Failed to save configuration rule.', 'error');
  } finally {
    saveRuleBtn.disabled = false;
    saveRuleBtn.querySelector('span').textContent = 'Save Configuration';
  }
}

// Delete Policy via API
async function deletePolicy(id) {
  if (!confirm(`Are you sure you want to delete the configuration for "${id}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`/api/policy/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    
    const result = await response.json();
    
    if (!response.ok) {
      throw new Error(result.error || 'Server error occurred');
    }
    
    showToast(result.message || 'Policy removed successfully.');
    
    // Update local state and UI
    policyState = result.data;
    updateDashboard();
    
  } catch (error) {
    console.error('Error deleting policy:', error);
    showToast(error.message || 'Failed to delete configuration rule.', 'error');
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
