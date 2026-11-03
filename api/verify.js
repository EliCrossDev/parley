// GET /api/verify?session_id=cs_… → { ok, token, email } after a successful checkout redirect.
const { configured, stripe, makeToken, json, isOurPrice } = require('./_stripe');
module.exports = async (req, res) => {
  if (!configured()) return json(res, 503, { ok: false, error: 'Not configured.' });
  const id = String((req.query && req.query.session_id) || '').trim();
  if (!/^cs_[A-Za-z0-9_]+$/.test(id)) return json(res, 400, { ok: false, error: 'Bad session id.' });
  try {
    const s = await stripe('GET', '/checkout/sessions/' + id + '?expand[]=line_items');
    const items = (s.line_items && s.line_items.data) || [];
    const paid = s.payment_status === 'paid' && items.some((li) => li.price && isOurPrice(li.price.id));
    const email = (s.customer_details && s.customer_details.email) || '';
    if (!paid || !email) return json(res, 402, { ok: false, error: 'Payment not completed.' });
    return json(res, 200, { ok: true, token: makeToken(email), email });
  } catch (e) { return json(res, 500, { ok: false, error: e.message }); }
};
