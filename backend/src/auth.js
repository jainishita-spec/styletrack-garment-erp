const crypto = require('crypto');

const SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const TOKEN_TTL_SEC = 60 * 60 * 24 * 7; // 7 days

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex'));
}

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

// Minimal HS256 JWT (no external dependency)
function signToken(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC }));
  const sig = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  try {
    const [header, body, sig] = String(token).split('.');
    if (!header || !body || !sig) return null;
    const expected = b64url(crypto.createHmac('sha256', SECRET).update(`${header}.${body}`).digest());
    if (expected.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
    const payload = JSON.parse(Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  const payload = token && verifyToken(token);
  if (!payload) return res.status(401).json({ error: 'Login required' });
  req.user = payload;
  next();
}

// Roles: admin, merchant, store, production, accounts
function allow(...roles) {
  return (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || roles.includes(req.user.role))) return next();
    return res.status(403).json({ error: 'You do not have permission for this action' });
  };
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken, requireAuth, allow };
