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

app.set('trust proxy', 1);

app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(cors({
  origin:      process.env.SITE_URL || 'http://localhost:3000',
  credentials: true,
}));

// ── Auto-inject Google Analytics into every HTML page ───────────────────────
// Uses sendFile interception so it works for static files too
const fs = require('fs');
const GA_SNIPPET = `<!-- Google Analytics 4 -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-7MGX2RJX2L"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','G-7MGX2RJX2L');</script>
`;
const GTM_HEAD = `<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-56BM6RWR');</script><!-- End Google Tag Manager -->`;
const GTM_BODY = `<!-- Google Tag Manager (noscript) --><noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-56BM6RWR" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript><!-- End Google Tag Manager (noscript) -->`;
const CHAT_SNIPPET = ``; // Chat widget hidden — re-enable by restoring the script tag

app.use((req, res, next) => {
  // Only intercept HTML requests
  const origSendFile = res.sendFile.bind(res);
  res.sendFile = function (filePath, options, callback) {
    if (typeof filePath === 'string' && filePath.endsWith('.html')) {
      try {
        let content = fs.readFileSync(filePath, 'utf8');
        if (!content.includes('G-7MGX2RJX2L')) {
          content = content.replace('</head>', GA_SNIPPET + '</head>');
        }
        if (!content.includes('GTM-56BM6RWR')) {
          content = content.replace('<head>', '<head>' + GTM_HEAD);
          content = content.replace('<body>', '<body>' + GTM_BODY);
        }
        if (!content.includes('chat-widget.js')) {
          content = content.replace('</body>', CHAT_SNIPPET + '</body>');
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.send(content);
      } catch (e) {
        return origSendFile(filePath, options, callback);
      }
    }
    return origSendFile(filePath, options, callback);
  };

  // Also intercept res.send for dynamic responses
  const origSend = res.send.bind(res);
  res.send = function (body) {
    if (typeof body === 'string' && body.includes('</head>')) {
      if (!body.includes('G-7MGX2RJX2L')) {
        body = body.replace('</head>', GA_SNIPPET + '</head>');
      }
      if (!body.includes('GTM-56BM6RWR')) {
        body = body.replace('<head>', '<head>' + GTM_HEAD);
        body = body.replace('<body>', '<body>' + GTM_BODY);
      }
      if (!body.includes('chat-widget.js')) {
        body = body.replace('</body>', CHAT_SNIPPET + '</body>');
      }
    }
    return origSend(body);
  };

  next();
});

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

// ── Home ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/account', (req, res) => {
  const token = req.cookies['aiq_token'];
  if (!token) return res.redirect('/');
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.redirect('/');
    res.sendFile(path.join(__dirname, 'account.html'));
  } catch(e) {
    res.redirect('/');
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

// ── Favicon ──────────────────────────────────────────────────────────────────
app.get('/favicon.ico', (_req, res) => {
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'favicon.png'));
});

// ── OG images (social share previews) ───────────────────────────────────────
app.get('/og-image.png', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'og-image.svg'));
});
app.get('/og-image-coming-soon.png', (_req, res) => {
  res.setHeader('Content-Type', 'image/svg+xml');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.sendFile(path.join(__dirname, 'og-image-coming-soon.svg'));
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

// ── Early access email capture ───────────────────────────────────────────────
app.post('/api/early-access', express.json(), (req, res) => {
  const { email } = req.body || {};
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }
  try {
    db.prepare('INSERT OR IGNORE INTO early_access (email) VALUES (?)').run(email.toLowerCase().trim());
    console.log('[early-access] saved:', email);
  } catch (e) {
    console.error('[early-access] db error:', e.message);
  }
  res.json({ ok: true });
});

// ── Admin: early access list ─────────────────────────────────────────────────
app.get('/api/admin/early-access', (req, res) => {
  const token = req.cookies['aiq_token'];
  if (!token) return res.status(401).json({ error: 'Unauthorized.' });
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT email FROM users WHERE id = ?').get(id);
    const allowed = ['michael.neftali@gmail.com'];
    if (!user || !allowed.includes(user.email)) return res.status(403).json({ error: 'Forbidden.' });
    const rows = db.prepare('SELECT email, created_at FROM early_access ORDER BY created_at DESC').all();
    res.json(rows);
  } catch(e) {
    res.status(401).json({ error: 'Unauthorized.' });
  }
});

// ── API routes ──────────────────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth'));
app.use('/api/chat', require('./routes/chat'));

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
