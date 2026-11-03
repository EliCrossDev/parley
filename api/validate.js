// POST /api/validate { token } → { ok, email } — lets the app re-check a stored Pro token.
const { configured, checkToken, json, readBody } = require('./_stripe');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { ok: false });
  if (!configured()) return json(res, 503, { ok: false, error: 'Not configured.' });
  const { token } = await readBody(req);
  const email = checkToken(token);
  return json(res, email ? 200 : 401, email ? { ok: true, email } : { ok: false });
};
