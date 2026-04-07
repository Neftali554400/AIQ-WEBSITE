require('dotenv').config();
const express      = require('express');
const cookieParser = require('cookie-parser');
const cors         = require('cors');
const path         = require('path');
const jwt          = require('jsonwebtoken');
const db           = require('./db/database');

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err);
});

const app  = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin:      process.env.SITE_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Server-side guard for account page ─────────────────────────────────────
// Checks JWT + token_version before sending the HTML.
// This runs before static file serving so no cached HTML bypasses it.
app.get('/account.html', (req, res) => {
  const token = req.cookies['aiq_token'];
  if (!token) return res.redirect('/signup.html');
  try {
    const { id, tv = 0 } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT token_version FROM users WHERE id = ?').get(id);
    if (!user || (user.token_version ?? 0) !== tv) return res.redirect('/signup.html');
    res.sendFile(path.join(__dirname, 'account.html'));
  } catch(e) {
    res.redirect('/signup.html');
  }
});

// Serve all static files (HTML, CSS, images, etc.) from the project root
app.use(express.static(path.join(__dirname)));

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── 404 for unknown API calls ───────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ── Serve index.html for any non-file route (client-side nav) ───────────────
app.get('/{*path}', (req, res) => {
  if (path.extname(req.path)) return res.status(404).send('Not found.');
  res.sendFile(path.join(__dirname, 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  ✦ AIQ server →  http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  console.error('[server error]', err);
});
