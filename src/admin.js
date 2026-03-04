'use strict';
/**
 * admin.js — admin management routes.
 *
 * Token auth routes:
 * POST /admin/auth/login      body: { secret }
 * POST /admin/auth/refresh    body: { refresh_token }
 * POST /admin/auth/logout     body: { refresh_token }
 * GET  /admin/auth/me         current auth state (access token required)
 *
 * Management routes (access token required):
 * POST   /admin/sites
 * GET    /admin/sites
 * GET    /admin/sites/:id
 * PATCH  /admin/sites/:id
 * DELETE /admin/sites/:id
 * POST   /admin/sites/:id/rotate
 * GET    /admin/sites/:id/stats
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');

const db = require('./db');
const {
  issueTokenPair,
  logoutWithRefreshToken,
  requireAccessToken,
  rotateRefreshToken,
  verifyAdminSecret,
} = require('./admin-auth');

const router = express.Router();

// ── Helpers ───────────────────────────────────────────────────────────────────
function generateApiKey() {
  const hex = [...Array(40)].map(() => Math.floor(Math.random() * 16).toString(16)).join('');
  return `capi_${hex}`;
}

function stripToken(site) {
  if (!site) return site;
  return {
    ...site,
    fb_token: site.fb_token ? `${site.fb_token.slice(0, 8)}…[hidden]` : null,
  };
}

function tokenPayload(tokens) {
  return {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    access_expires_at: tokens.accessExpiresAt,
    refresh_expires_at: tokens.refreshExpiresAt,
  };
}

// ── POST /admin/auth/login ───────────────────────────────────────────────────
router.post('/auth/login', async (req, res) => {
  try {
    const secret = typeof req.body?.secret === 'string' ? req.body.secret.trim() : '';
    if (!verifyAdminSecret(secret)) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const tokens = await issueTokenPair();
    return res.json(tokenPayload(tokens));
  } catch (err) {
    console.error('Admin login failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /admin/auth/refresh ─────────────────────────────────────────────────
router.post('/auth/refresh', async (req, res) => {
  try {
    const refreshToken = typeof req.body?.refresh_token === 'string'
      ? req.body.refresh_token.trim()
      : '';

    if (!refreshToken) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    const tokens = await rotateRefreshToken(refreshToken);
    if (!tokens) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    return res.json(tokenPayload(tokens));
  } catch (err) {
    console.error('Token refresh failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── POST /admin/auth/logout ──────────────────────────────────────────────────
router.post('/auth/logout', async (req, res) => {
  try {
    const refreshToken = typeof req.body?.refresh_token === 'string'
      ? req.body.refresh_token.trim()
      : '';

    if (!refreshToken) {
      return res.status(400).json({ error: 'refresh_token is required' });
    }

    await logoutWithRefreshToken(refreshToken);
    return res.json({ ok: true });
  } catch (err) {
    console.error('Logout failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── GET /admin/auth/me ───────────────────────────────────────────────────────
router.get('/auth/me', requireAccessToken, (req, res) => {
  return res.json({
    authenticated: true,
    access_expires_at: req.adminAuth.accessExpiresAt,
  });
});

// ── Protected management routes ───────────────────────────────────────────────
router.use(requireAccessToken);

// ── POST /admin/sites ─────────────────────────────────────────────────────────
router.post('/sites', async (req, res) => {
  try {
    const { name, domain, pixel_id, fb_token, note } = req.body;
    if (!name || !domain || !pixel_id || !fb_token) {
      return res.status(400).json({ error: 'name, domain, pixel_id, fb_token are required' });
    }

    const id      = uuidv4();
    const api_key = generateApiKey();

    await db.run(
      `INSERT INTO sites (id, name, domain, api_key, pixel_id, fb_token, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, domain.replace(/\/$/, ''), api_key, pixel_id, fb_token, note || null]
    );

    return res.status(201).json({ id, name, domain, pixel_id, api_key, note });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/sites ──────────────────────────────────────────────────────────
router.get('/sites', async (_req, res) => {
  try {
    const sites = await db.all('SELECT * FROM sites ORDER BY created_at DESC', []);
    return res.json(sites.map(stripToken));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/sites/:id ──────────────────────────────────────────────────────
router.get('/sites/:id', async (req, res) => {
  try {
    const site = await db.get('SELECT * FROM sites WHERE id = ?', [req.params.id]);
    if (!site) return res.status(404).json({ error: 'Not found' });
    return res.json(stripToken(site));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PATCH /admin/sites/:id ────────────────────────────────────────────────────
router.patch('/sites/:id', async (req, res) => {
  try {
    const allowed = ['name', 'domain', 'pixel_id', 'fb_token', 'active', 'note'];
    const updates = [];
    const values  = [];

    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        updates.push(`${key} = ?`);
        values.push(key === 'domain' ? req.body[key].replace(/\/$/, '') : req.body[key]);
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(req.params.id);
    const result = await db.run(
      `UPDATE sites SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ updated: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── DELETE /admin/sites/:id ───────────────────────────────────────────────────
router.delete('/sites/:id', async (req, res) => {
  try {
    const result = await db.run('DELETE FROM sites WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ deleted: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /admin/sites/:id/rotate ──────────────────────────────────────────────
router.post('/sites/:id/rotate', async (req, res) => {
  try {
    const newKey = generateApiKey();
    const result = await db.run(
      'UPDATE sites SET api_key = ? WHERE id = ?',
      [newKey, req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Not found' });
    return res.json({ api_key: newKey });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /admin/sites/:id/stats ────────────────────────────────────────────────
router.get('/sites/:id/stats', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 500);
    const rows  = await db.all(
      `SELECT * FROM event_log WHERE site_id = ? ORDER BY id DESC LIMIT ?`,
      [req.params.id, limit]
    );
    return res.json(rows);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
