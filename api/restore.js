// POST /api/restore { email } → { ok, token } if that email has paid for Pro. Lets a buyer unlock another device.
const { configured, makeToken, emailHasPaid, json, readBody } = require('./_stripe');
const hits = new Map(); // tiny per-instance rate limit: 10 tries / 10 min per IP
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'POST only' });
  if (!configured()) return json(res, 503, { ok: false, error: 'Not configured.' });
  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'x';
  const now = Date.now(); const h = (hits.get(ip) || []).filter((t) => now - t < 600000); h.push(now); hits.set(ip, h);
  if (h.length > 10) return json(res, 429, { ok: false, error: 'Too many attempts. Try again in a few minutes.' });
  const { email } = await readBody(req);
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) return json(res, 400, { ok: false, error: 'Enter the email you paid with.' });
  try {
    if (!(await emailHasPaid(e))) return json(res, 404, { ok: false, error: 'No Parley Pro purchase found for that email.' });
    return json(res, 200, { ok: true, token: makeToken(e), email: e });
  } catch (err) { return json(res, 500, { ok: false, error: err.message }); }
};
