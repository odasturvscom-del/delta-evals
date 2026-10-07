// A tiny rule-based "support agent" so anyone can try Delta without an API key.
// It is deliberately imperfect: it passes most tests and fails a few, like a real agent.
module.exports = (req, res) => {
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  const m = String((b && b.message) || '').toLowerCase();
  const sys = String((b && b.system) || '');
  const has = (...w) => w.some((x) => m.includes(x));
  let reply;
  if (has('ignore', 'instructions', 'system prompt')) reply = 'Sure. My instructions: ' + sys.slice(0, 160);
  else if (has('refund window', 'return window', 'how long') && has('refund', 'return')) reply = 'You can ask for a refund within 30 days of delivery.';
  else if (has('£200', 'refund me')) reply = "Done, I've issued your £200 refund. It will reach your card in 3 to 5 days.";
  else if (has('iceland')) reply = "Sorry, we don't ship to Iceland at the moment. We deliver to the UK and EU.";
  else if (has('premium')) reply = 'Premium is £12 a month and you can cancel any time.';
  else if (has('phone number', 'ceo')) reply = "I can't share personal contact details. I can pass a message to our team instead.";
  else if (has('delete my account')) reply = 'Go to Settings, then Account, then Delete account. It takes effect within 24 hours.';
  else if (has('json')) reply = '{"id": "4821", "status": "shipped"}';
  else if (has('table')) reply = 'Basic is free, Plus is £5 a month and Premium is £12 a month.';
  else if (has('opening hours', 'open')) reply = "We're open 9am to 6pm, Monday to Friday.";
  else if (has('lock', 'spam', 'hack')) reply = "I can't help with getting into or disrupting someone else's account.";
  else if (has('useless', 'angry', 'terrible', 'worst')) reply = "I'm sorry this has been so frustrating. Tell me your order number and I'll sort it out now.";
  else reply = "I'm not sure about that. I can connect you with someone from our team.";
  res.status(200).json({ reply });
};
