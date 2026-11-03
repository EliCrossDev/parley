// Shared helpers for the Parley Pro endpoints. Stripe REST via fetch (no SDK), HMAC-signed pro tokens.
const crypto = require('crypto');

const SK = process.env.STRIPE_SECRET_KEY || '';
const PRICE = process.env.STRIPE_PRICE_ID || '';
const SIGN = process.env.PRO_SIGNING_SECRET || '';

function configured() { return !!(SK && PRICE && SIGN); }

async function stripe(method, path, params) {
  const r = await fetch('https://api.stripe.com/v1' + path, {
    method,
    headers: { Authorization: 'Basic ' + Buffer.from(SK + ':').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    body: method === 'POST' ? new URLSearchParams(params || {}).toString() : undefined,
  });
  const j = await r.json();
  if (!r.ok) throw new Error((j.error && j.error.message) || ('Stripe ' + r.status));
  return j;
}

// Token = base64(email).HMAC — proves this email paid; stored on the device.
function makeToken(email) {
  const e = String(email || '').trim().toLowerCase();
  const body = Buffer.from(e).toString('base64url');
  const sig = crypto.createHmac('sha256', SIGN).update(body).digest('base64url');
  return body + '.' + sig;
}
function checkToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const want = crypto.createHmac('sha256', SIGN).update(body).digest('base64url');
  if (want.length !== sig.length || !crypto.timingSafeEqual(Buffer.from(want), Buffer.from(sig))) return null;
  return Buffer.from(body, 'base64url').toString('utf8');
}

// Has this email ever completed a paid checkout for the Pro price?
async function emailHasPaid(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!e) return false;
  const customers = await stripe('GET', '/customers?email=' + encodeURIComponent(e) + '&limit=10');
  for (const c of customers.data || []) {
    const sessions = await stripe('GET', '/checkout/sessions?customer=' + c.id + '&limit=20&expand[]=data.line_items');
    for (const s of sessions.data || []) {
      if (s.payment_status !== 'paid') continue;
      const items = (s.line_items && s.line_items.data) || [];
      if (items.some((li) => li.price && li.price.id === PRICE)) return true;
    }
  }
  // Guest checkouts (no customer object) still carry customer_details.email on the session.
  const recent = await stripe('GET', '/checkout/sessions?limit=100&expand[]=data.line_items');
  for (const s of recent.data || []) {
    const se = s.customer_details && s.customer_details.email;
    if (s.payment_status === 'paid' && se && se.toLowerCase() === e) {
      const items = (s.line_items && s.line_items.data) || [];
      if (items.some((li) => li.price && li.price.id === PRICE)) return true;
    }
  }
  return false;
}

function json(res, status, obj) { res.status(status).setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store'); res.end(JSON.stringify(obj)); }
async function readBody(req) { if (req.body && typeof req.body === 'object') return req.body; const chunks = []; for await (const c of req) chunks.push(c); try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch (e) { return {}; } }
function origin(req) { const proto = req.headers['x-forwarded-proto'] || 'https'; const host = req.headers['x-forwarded-host'] || req.headers.host; return proto + '://' + host; }

module.exports = { configured, stripe, makeToken, checkToken, emailHasPaid, json, readBody, origin, PRICE };
