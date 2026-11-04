// POST /api/checkout → { url } — creates a Stripe Checkout session for Parley Pro (one-time).
const { configured, stripe, json, origin, PRICE } = require('./_stripe');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return json(res, 405, { error: 'POST only' });
  if (!configured()) return json(res, 503, { error: 'Checkout is not configured yet.' });
  try {
    const base = origin(req);
    const s = await stripe('POST', '/checkout/sessions', {
      mode: 'payment',
      'line_items[0][price]': PRICE,
      'line_items[0][quantity]': '1',
      success_url: base + '/app?session_id={CHECKOUT_SESSION_ID}#profile',
      cancel_url: base + '/app#profile',
    });
    return json(res, 200, { url: s.url });
  } catch (e) { return json(res, 500, { error: e.message }); }
};
