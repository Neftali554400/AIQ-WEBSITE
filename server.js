require('dotenv').config();
const express      = require('express');
const compression  = require('compression');
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

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(cors({
  origin:      process.env.SITE_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Strip .html extension → redirect to clean URL ───────────────────────────
app.use((req, res, next) => {
  if (req.path.endsWith('.html')) {
    let clean = req.path.slice(0, -5) || '/';
    if (clean === '/index') clean = '/';
    const qs = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    return res.redirect(301, clean + qs);
  }
  next();
});

// ── Server-side guard for /account ──────────────────────────────────────────
app.get('/account', (req, res) => {
  const token = req.cookies['aiq_token'];
  if (!token) return res.redirect('/signup');
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.redirect('/signup');
    res.sendFile(path.join(__dirname, 'account.html'));
  } catch(e) {
    res.redirect('/signup');
  }
});

// Serve static files with caching; extensions:['html'] lets /about serve about.html
app.use(express.static(path.join(__dirname), {
  extensions: ['html'],
  maxAge: '1d',
  setHeaders(res, filePath) {
    // Don't cache HTML pages — always serve fresh
    if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
  },
}));

// ── OG image (social share preview) ─────────────────────────────────────────
app.get('/og-image.png', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'og-image.svg'));
});

// ── Sitemap & robots ────────────────────────────────────────────────────────
app.get('/sitemap.xml', (_req, res) => {
  res.setHeader('Content-Type', 'application/xml');
  res.sendFile(path.join(__dirname, 'sitemap.xml'));
});
app.get('/robots.txt', (_req, res) => {
  res.setHeader('Content-Type', 'text/plain');
  res.sendFile(path.join(__dirname, 'robots.txt'));
});

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// ── 404 for unknown API calls ───────────────────────────────────────────────
app.use('/api', (req, res) => res.status(404).json({ error: 'Not found.' }));

// ── 404 for any unmatched route ─────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).sendFile(path.join(__dirname, '404.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n  ✦ AIQ server →  http://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  console.error('[server error]', err);
});
