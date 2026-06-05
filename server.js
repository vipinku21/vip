const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static assets from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Serve frontend fallback for any other requests (Single Page Application friendly)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 Extension Policy Manager (Local Static Server)`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`==================================================`);
});
