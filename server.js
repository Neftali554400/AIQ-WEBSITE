require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const path         = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin:      process.env.SITE_URL || 'http://localhost:3000',
  credentials: true,
}));

// Serve all static files (HTML, CSS, images, etc.) from the project root
app.use(express.static(path.join(__dirname)));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── 404 for unknown API calls ───────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Serve index.html for any non-file route (client-side nav) ───────────────
app.get('*', (req, res) => {
  if (path.extname(req.path)) return res.status(404).send('Not found.');
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n  ✦ AIQ server →  http://localhost:${PORT}\n`);
});
