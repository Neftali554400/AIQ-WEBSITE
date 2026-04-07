const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const crypto  = require('crypto');
const { Resend } = require('resend');
const db      = require('../db/database');

const router   = express.Router();
const COOKIE   = 'aiq_token';
const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';

// ─── Failed attempt tracking (in-memory) ─────────────────────────────────────
const failedAttempts = new Map(); // email -> { count, lastAt }
function getAttempts(email) { return failedAttempts.get(email) || { count: 0, lastAt: 0 }; }
function recordFail(email) {
  const a = getAttempts(email);
  failedAttempts.set(email, { count: a.count + 1, lastAt: Date.now() });
  return a.count + 1;
}
function clearAttempts(email) { failedAttempts.delete(email); }

// ─── Resend email client ──────────────────────────────────────────────────────
function getResend() {
  return new Resend(process.env.RESEND_API_KEY);
}

async function sendOtpEmail(to, name, otp) {
  console.log('[sendOtpEmail] Sending to:', to);
  const result = await getResend().emails.send({
    from: 'AIQ <noreply@aiq-courses.com>',
    to,
    subject: `${otp} — your AIQ verification code`,
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;font-size:14px">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Your AIQ email verification code is:</p>
        <div style="font-size:40px;font-weight:700;letter-spacing:10px;color:#034f46;margin:24px 0">${otp}</div>
        <p>This code expires in <strong>10 minutes</strong>.</p>
        <p style="color:#aaa;font-size:12px">If you didn't create an AIQ account, you can safely ignore this email.</p>
      </div>`,
  });
  console.log('[sendOtpEmail] Result:', JSON.stringify(result));
  if (result.error) throw new Error(result.error.message || JSON.stringify(result.error));
}

async function sendWelcomeEmail(to, name) {
  const coursesUrl = `${SITE_URL}/courses#all-courses`;
  await getResend().emails.send({
    from: 'AIQ <hello@aiq-courses.com>',
    to,
    subject: 'Welcome to AIQ — start your learning journey',
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:520px;margin:0 auto;background:#0a0a08;color:#ffffeb;border-radius:12px;overflow:hidden">
        <div style="background:#034f46;padding:32px 40px;text-align:center">
          <span style="font-family:Georgia,serif;font-size:28px;font-weight:500;color:#ffffeb;letter-spacing:-0.02em">AIQ</span>
        </div>
        <div style="padding:40px">
          <h1 style="font-family:Georgia,serif;font-size:24px;font-weight:500;margin:0 0 12px;color:#ffffeb">Welcome to AIQ Courses, ${name}!</h1>
          <p style="color:rgba(255,255,235,0.7);line-height:1.7;margin:0 0 8px">Your account is ready. Start your learning journey today — pick a course, learn at your own pace, and build real AI skills.</p>
          <div style="margin:32px 0;text-align:center">
            <a href="${coursesUrl}" style="display:inline-block;padding:14px 32px;background:#034f46;color:#ffffeb;border-radius:9999px;text-decoration:none;font-weight:600;font-size:15px">Explore Courses</a>
          </div>
          <p style="color:rgba(255,255,235,0.35);font-size:12px;line-height:1.6;margin:0">You're receiving this because you created an AIQ account. If this wasn't you, please ignore this email.</p>
        </div>
      </div>`,
  });
}

async function sendResetEmail(to, name, token) {
  const url = `${SITE_URL}/reset-password?token=${token}`;
  await getResend().emails.send({
    from: 'AIQ <noreply@aiq-courses.com>',
    to,
    subject: 'Reset your AIQ password',
    html: `
      <div style="font-family:system-ui,Arial,sans-serif;max-width:480px;font-size:14px">
        <p>Hi <strong>${name}</strong>,</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${url}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#034f46;color:#ffffeb;border-radius:8px;text-decoration:none;font-weight:600;font-size:15px">
          Reset password
        </a>
        <p>Or copy this link:<br><a href="${url}" style="color:#034f46;word-break:break-all">${url}</a></p>
        <p style="color:#aaa;font-size:12px">If you didn't request a password reset, ignore this email — your password won't change.</p>
      </div>`,
  });
}

// ─── Helper: issue JWT in httpOnly cookie ────────────────────────────────────
function issueToken(res, userId, tv = 0) {
  const token = jwt.sign({ id: userId, tv }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge:   7 * 24 * 60 * 60 * 1000,
  });
}

// ─── POST /api/auth/signup ───────────────────────────────────────────────────
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ error: 'All fields are required.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (existing)
      return res.status(409).json({ error: 'An account with this email already exists. Sign in instead.' });

    // Invalidate any previous OTPs, create new one
    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ?').run(email.toLowerCase());
    db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email.toLowerCase(), otp, expires);

    await sendOtpEmail(email, name, otp);
    res.json({ ok: true });
  } catch (err) {
    console.error('[signup]', err);
    res.status(500).json({ error: 'Failed to send verification email. Check server config.' });
  }
});

// ─── POST /api/auth/verify-otp ──────────────────────────────────────────────
router.post('/verify-otp', async (req, res) => {
  try {
    const { name, email, password, code } = req.body;
    if (!name || !email || !password || !code)
      return res.status(400).json({ error: 'Missing required fields.' });

    const record = db.prepare(
      'SELECT * FROM otp_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
    ).get(email.toLowerCase());

    if (!record)
      return res.status(400).json({ error: 'No active code found. Please sign up again.' });
    if (Date.now() > record.expires_at)
      return res.status(400).json({ error: 'Code has expired. Click "Resend code".' });
    if (record.code !== String(code).trim())
      return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    // Mark used
    db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(record.id);

    // Race-condition guard
    const dup = db.prepare('SELECT id FROM users WHERE email = ?').get(email.toLowerCase());
    if (dup) return res.status(409).json({ error: 'Account already exists.' });

    const hash   = await bcrypt.hash(password, 12);
    const result = db.prepare(
      'INSERT INTO users (name, email, password_hash, provider, verified, joined) VALUES (?, ?, ?, ?, 1, ?)'
    ).run(name, email.toLowerCase(), hash, 'email', new Date().toISOString().split('T')[0]);

    const user = db.prepare('SELECT id, name, email, picture, provider, joined, token_version FROM users WHERE id = ?').get(result.lastInsertRowid);
    issueToken(res, user.id, user.token_version);
    const { token_version, ...safeUser } = user;
    res.json({ ok: true, user: safeUser });
    sendWelcomeEmail(user.email, user.name).catch(e => console.error('[welcome-email]', e.message));
  } catch (err) {
    console.error('[verify-otp]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/resend-otp ──────────────────────────────────────────────
router.post('/resend-otp', async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ?').run(email.toLowerCase());
    db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email.toLowerCase(), otp, expires);

    await sendOtpEmail(email, name || 'there', otp);
    res.json({ ok: true });
  } catch (err) {
    console.error('[resend-otp]', err.message);
    res.status(500).json({ error: 'Failed to resend.' });
  }
});

// ─── POST /api/auth/signin ───────────────────────────────────────────────────
router.post('/signin', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: 'Email and password required.' });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user)
      return res.status(401).json({ error: 'No account found with this email.' });
    if (user.provider !== 'email')
      return res.status(401).json({ error: `This account was created with ${user.provider}. Use that sign-in button.` });

    const match = await bcrypt.compare(password, user.password_hash);
    if (!match) {
      const count = recordFail(email);
      const hint  = count >= 2;
      return res.status(401).json({
        error: 'Incorrect password. Please try again.',
        hint:  hint ? 'forgot_password' : null,
      });
    }

    clearAttempts(email);

    // Send OTP as 2nd factor before issuing session
    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ?').run(email.toLowerCase());
    db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email.toLowerCase(), otp, expires);
    await sendOtpEmail(email, user.name, otp);
    res.json({ ok: true, otpSent: true });
  } catch (err) {
    console.error('[signin]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/signout ──────────────────────────────────────────────────
router.post('/signout', (req, res) => {
  const token = req.cookies[COOKIE];
  if (token) {
    try {
      const { id } = jwt.verify(token, process.env.JWT_SECRET);
      db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?').run(id);
    } catch(e) { /* expired/invalid token — nothing to invalidate */ }
  }
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

// ─── POST /api/auth/verify-signin-otp ───────────────────────────────────────
router.post('/verify-signin-otp', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code)
      return res.status(400).json({ error: 'Email and code required.' });

    const record = db.prepare(
      'SELECT * FROM otp_codes WHERE email = ? AND used = 0 ORDER BY created_at DESC LIMIT 1'
    ).get(email.toLowerCase());

    if (!record) return res.status(400).json({ error: 'No active code found. Please sign in again.' });
    if (Date.now() > record.expires_at) return res.status(400).json({ error: 'Code has expired. Click "Resend code".' });
    if (record.code !== String(code).trim()) return res.status(400).json({ error: 'Incorrect code. Please try again.' });

    db.prepare('UPDATE otp_codes SET used = 1 WHERE id = ?').run(record.id);

    const user = db.prepare('SELECT id, name, email, picture, provider, joined, token_version FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    issueToken(res, user.id, user.token_version);
    const { token_version, password_hash, ...safeUser } = user;
    res.json({ ok: true, user: safeUser });
  } catch (err) {
    console.error('[verify-signin-otp]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/resend-signin-otp ───────────────────────────────────────
router.post('/resend-signin-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const user = db.prepare('SELECT name FROM users WHERE email = ?').get(email.toLowerCase());
    if (!user) return res.status(404).json({ error: 'Account not found.' });

    const otp     = String(Math.floor(100000 + Math.random() * 900000));
    const expires = Date.now() + 10 * 60 * 1000;
    db.prepare('UPDATE otp_codes SET used = 1 WHERE email = ?').run(email.toLowerCase());
    db.prepare('INSERT INTO otp_codes (email, code, expires_at) VALUES (?, ?, ?)').run(email.toLowerCase(), otp, expires);
    await sendOtpEmail(email, user.name, otp);
    res.json({ ok: true });
  } catch (err) {
    console.error('[resend-signin-otp]', err.message);
    res.status(500).json({ error: 'Failed to resend.' });
  }
});

// ─── POST /api/auth/delete-account ──────────────────────────────────────────
router.post('/delete-account', (req, res) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const { id } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found.' });

    db.prepare('DELETE FROM enrollments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM payments WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM reset_tokens WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM otp_codes WHERE email = ?').run(user.email);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);

    res.clearCookie(COOKIE);
    res.json({ ok: true });
  } catch(err) {
    console.error('[delete-account]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

// ─── POST /api/auth/google ───────────────────────────────────────────────────
router.post('/google', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token required.' });

    const gRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: 'Bearer ' + accessToken },
    });
    if (!gRes.ok) return res.status(401).json({ error: 'Invalid Google token. Please try again.' });
    const profile = await gRes.json();
    if (!profile.email) return res.status(400).json({ error: 'Google did not return an email address.' });

    let isNewUser = false;
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email.toLowerCase());
    if (!user) {
      isNewUser = true;
      const r = db.prepare(
        'INSERT INTO users (name, email, provider, picture, verified, joined) VALUES (?, ?, ?, ?, 1, ?)'
      ).run(profile.name || profile.email, profile.email.toLowerCase(), 'google', profile.picture || null, new Date().toISOString().split('T')[0]);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    } else if (user.provider !== 'google') {
      // Link Google to existing account — update provider and picture
      db.prepare('UPDATE users SET provider = ?, picture = ? WHERE id = ?')
        .run('google', profile.picture || user.picture, user.id);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    }

    issueToken(res, user.id, user.token_version || 0);
    const { password_hash, token_version, ...safeUser } = user;
    res.json({ ok: true, user: safeUser });
    if (isNewUser) sendWelcomeEmail(user.email, user.name).catch(e => console.error('[welcome-email]', e.message));
  } catch(err) {
    console.error('[google]', err.message);
    res.status(500).json({ error: 'Google sign-in failed. Please try again.' });
  }
});

// ─── POST /api/auth/facebook ─────────────────────────────────────────────────
router.post('/facebook', async (req, res) => {
  try {
    const { accessToken } = req.body;
    if (!accessToken) return res.status(400).json({ error: 'Access token required.' });

    const fbRes = await fetch(
      `https://graph.facebook.com/me?fields=id,name,email,picture.width(200)&access_token=${encodeURIComponent(accessToken)}`
    );
    if (!fbRes.ok) return res.status(401).json({ error: 'Invalid Facebook token. Please try again.' });
    const profile = await fbRes.json();
    if (!profile.email) return res.status(400).json({ error: 'Facebook did not share your email. Please grant email permission and try again.' });

    const picture = profile.picture?.data?.url || null;
    let user = db.prepare('SELECT * FROM users WHERE email = ?').get(profile.email.toLowerCase());
    if (!user) {
      const r = db.prepare(
        'INSERT INTO users (name, email, provider, picture, verified, joined) VALUES (?, ?, ?, ?, 1, ?)'
      ).run(profile.name || profile.email, profile.email.toLowerCase(), 'facebook', picture, new Date().toISOString().split('T')[0]);
      user = db.prepare('SELECT * FROM users WHERE id = ?').get(r.lastInsertRowid);
    } else if (user.provider !== 'facebook') {
      return res.status(409).json({ error: `This email is linked to a ${user.provider === 'email' ? 'password' : user.provider} account. Use that sign-in method.` });
    }

    issueToken(res, user.id, user.token_version || 0);
    const { password_hash, token_version, ...safeUser } = user;
    res.json({ ok: true, user: safeUser });
  } catch(err) {
    console.error('[facebook]', err.message);
    res.status(500).json({ error: 'Facebook sign-in failed. Please try again.' });
  }
});

// ─── GET /api/auth/me ────────────────────────────────────────────────────────
router.get('/me', (req, res) => {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated.' });
  try {
    const { id, tv = 0 } = jwt.verify(token, process.env.JWT_SECRET);
    const user = db.prepare('SELECT id, name, email, picture, provider, joined, token_version FROM users WHERE id = ?').get(id);
    if (!user) return res.status(401).json({ error: 'User not found.' });
    if ((user.token_version ?? 0) !== (tv ?? 0)) return res.status(401).json({ error: 'Session expired. Please sign in again.' });
    const { token_version, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch {
    res.status(401).json({ error: 'Invalid or expired session.' });
  }
});

// ─── POST /api/auth/forgot-password ─────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  const OK_MSG = 'If an account with that email exists, a reset link has been sent.';
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });

    const user = db.prepare("SELECT * FROM users WHERE email = ? AND provider = 'email'").get(email.toLowerCase());
    // Always return success — prevents email enumeration
    if (!user) return res.json({ ok: true, message: OK_MSG });

    const token   = crypto.randomBytes(32).toString('hex');
    const expires = Date.now() + 60 * 60 * 1000; // 1 hour
    db.prepare('INSERT INTO reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)').run(user.id, token, expires);

    await sendResetEmail(email, user.name, token);
    res.json({ ok: true, message: OK_MSG });
  } catch (err) {
    console.error('[forgot-password]', err.message);
    res.status(500).json({ error: 'Failed to send reset email.' });
  }
});

// ─── POST /api/auth/reset-password ──────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password)
      return res.status(400).json({ error: 'Token and new password required.' });
    if (password.length < 8)
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });

    const record = db.prepare('SELECT * FROM reset_tokens WHERE token = ? AND used = 0').get(token);
    if (!record)
      return res.status(400).json({ error: 'Invalid or already used reset link. Request a new one.' });
    if (Date.now() > record.expires_at)
      return res.status(400).json({ error: 'This reset link has expired. Request a new one.' });

    const hash = await bcrypt.hash(password, 12);
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, record.user_id);
    db.prepare('UPDATE reset_tokens SET used = 1 WHERE id = ?').run(record.id);

    res.json({ ok: true, message: 'Password updated successfully. You can now sign in.' });
  } catch (err) {
    console.error('[reset-password]', err.message);
    res.status(500).json({ error: 'Server error. Please try again.' });
  }
});

module.exports = router;
