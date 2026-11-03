// GET /api/status → { configured } — the app hides the Buy button until Stripe env vars exist.
const { configured, json } = require('./_stripe');
module.exports = (req, res) => json(res, 200, { configured: configured() });
