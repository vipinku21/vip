const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const POLICY_FILE = path.join(__dirname, 'policy.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to read the policy file
async function readPolicyFile() {
  try {
    const data = await fs.readFile(POLICY_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      // If file doesn't exist, return empty object
      return {};
    }
    throw error;
  }
}

// Helper function to write to the policy file safely (atomic write)
async function writePolicyFile(data) {
  const tempFile = `${POLICY_FILE}.tmp`;
  // Indent with 2 spaces to preserve user's formatting style
  const formattedJson = JSON.stringify(data, null, 2);
  await fs.writeFile(tempFile, formattedJson, 'utf8');
  await fs.rename(tempFile, POLICY_FILE);
}

// GET API: Retrieve extension policy
app.get('/api/policy', async (req, res) => {
  try {
    const policies = await readPolicyFile();
    res.json(policies);
  } catch (error) {
    console.error('Error reading policy file:', error);
    res.status(500).json({ error: 'Failed to read extension policy configuration.' });
  }
});

// POST API: Add or update an extension policy
app.post('/api/policy', async (req, res) => {
  const { id, installation_mode, blocked_install_message } = req.body;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Extension ID is required and must be a string.' });
  }

  const normalizedId = id.trim();
  if (normalizedId === '') {
    return res.status(400).json({ error: 'Extension ID cannot be empty.' });
  }

  if (installation_mode !== 'allowed' && installation_mode !== 'blocked') {
    return res.status(400).json({ error: 'Installation mode must be either "allowed" or "blocked".' });
  }

  try {
    const policies = await readPolicyFile();

    // Prepare updated config object
    const extensionConfig = {
      installation_mode: installation_mode
    };

    if (installation_mode === 'blocked' && blocked_install_message) {
      const msg = blocked_install_message.trim();
      if (msg) {
        extensionConfig.blocked_install_message = msg;
      }
    }

    // Update in memory
    policies[normalizedId] = extensionConfig;

    // Write back to file
    await writePolicyFile(policies);
    res.json({ success: true, message: `Policy for ${normalizedId} updated successfully.`, data: policies });
  } catch (error) {
    console.error('Error writing policy file:', error);
    res.status(500).json({ error: 'Failed to update extension policy configuration.' });
  }
});

// DELETE API: Remove an extension policy
app.delete('/api/policy/:id', async (req, res) => {
  const idToDelete = req.params.id;

  if (!idToDelete) {
    return res.status(400).json({ error: 'Extension ID is required.' });
  }

  try {
    const policies = await readPolicyFile();

    if (!(idToDelete in policies)) {
      return res.status(404).json({ error: `Extension ID "${idToDelete}" not found in policy configuration.` });
    }

    // Delete in memory
    delete policies[idToDelete];

    // Write back to file
    await writePolicyFile(policies);
    res.json({ success: true, message: `Policy for ${idToDelete} removed successfully.`, data: policies });
  } catch (error) {
    console.error('Error writing policy file:', error);
    res.status(500).json({ error: 'Failed to remove extension policy configuration.' });
  }
});

const https = require('https');

// Helper to fetch external IP address for localtunnel verification
function getPublicIp() {
  return new Promise((resolve) => {
    https.get('https://api.ipify.org', (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data.trim()));
    }).on('error', () => resolve('Could not retrieve public IP'));
  });
}

// Serve frontend fallback for any other requests (SPA friendly)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, async () => {
  console.log(`==================================================`);
  console.log(`🚀 Extension Policy Manager Running Locally`);
  console.log(`👉 http://localhost:${PORT}`);
  
  // Fetch public IP first
  const publicIp = await getPublicIp();
  
  try {
    const localtunnel = require('localtunnel');
    const tunnel = await localtunnel({ port: PORT });
    console.log(`📡 Secure Public Tunnel Active: ${tunnel.url}`);
    console.log(`🔑 Tunnel Password (Public IP): ${publicIp}`);
  } catch (err) {
    console.log(`⚠️ Public tunnel could not be started: ${err.message}`);
  }
  
  console.log(`==================================================`);
});
