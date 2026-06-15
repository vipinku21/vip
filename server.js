const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const POLICY_FILE = path.join(__dirname, 'policy.json');

app.use(express.json());

// Helper function to read policy file safely
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

// Helper function to write to policy file safely
async function writePolicyFile(data) {
  const tempFile = `${POLICY_FILE}.tmp`;
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

// POST API: Save/Overwrite extension policy
app.post('/api/policy', async (req, res) => {
  try {
    const policies = req.body;
    if (typeof policies !== 'object' || policies === null || Array.isArray(policies)) {
      return res.status(400).json({ error: 'Invalid policy payload.' });
    }
    await writePolicyFile(policies);
    res.json({ success: true, message: 'Policy configuration updated successfully.' });
  } catch (error) {
    console.error('Error writing policy file:', error);
    res.status(500).json({ error: 'Failed to update extension policy configuration.' });
  }
});

// Serve static assets from the root directory
app.use(express.static(__dirname));

// Serve index.html as a fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Extension Policy Manager (Server Mode Active)`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`==================================================`);
});
