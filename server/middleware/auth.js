/**
 * Admin authentication middleware
 */
import crypto from 'crypto';

const adminSessions = new Map(); // key: token, value: { createdAt, expiresAt }
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа

function parseCookies(req) {
  const header = req.headers.cookie;
  const cookies = {};
  if (!header) return cookies;
  const parts = header.split(';');
  for (const part of parts) {
    const [name, ...rest] = part.split('=');
    const key = name && name.trim();
    if (!key) continue;
    const value = rest.join('=').trim();
    cookies[key] = decodeURIComponent(value || '');
  }
  return cookies;
}

export function getAdminSessionFromRequest(req) {
  const cookies = parseCookies(req);
  const token = cookies['admin_session'];
  if (!token) return null;
  const session = adminSessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    if (session) {
      adminSessions.delete(token);
    }
    return null;
  }
  return { token, ...session };
}

export function requireAdminAuth(req, res, next) {
  const session = getAdminSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  req.adminSession = session;
  next();
}

export function createAdminSession() {
  const token = crypto.randomBytes(32).toString('hex');
  const now = Date.now();
  adminSessions.set(token, {
    createdAt: now,
    expiresAt: now + ADMIN_SESSION_TTL_MS,
  });
  return token;
}

export function deleteAdminSession(token) {
  adminSessions.delete(token);
}

