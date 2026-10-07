// Delta live runner: sends one test to one target, scores the reply, returns the result.
// API keys arrive with each request and are never stored or logged.
const dns = require('dns').promises;
const net = require('net');

const TIMEOUT_MS = 45000;
const MAX_PROMPT = 6000;

function privateIp(ip) {
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::' || x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe80')) return true;
    if (x.startsWith('::ffff:')) return privateIp(x.slice(7));
    return false;
  }
  const p = ip.split('.').map(Number);
  return p[0] === 10 || p[0] === 127 || p[0] === 0 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
}
async function safeUrl(raw) {
  let u;
  try { u = new URL(raw); } catch (e) { throw new Error('That URL is not valid.'); }
  if (u.protocol !== 'https:') throw new Error('Use an https:// URL.');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('Private addresses are not allowed.');
  const addrs = await dns.lookup(u.hostname, { all: true }).catch(() => { throw new Error('Could not find that host.'); });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('Private addresses are not allowed.');
  return u.toString();
}

async function post(url, headers, body) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: Object.assign({ 'content-type': 'application/json' }, headers), body: JSON.stringify(body), signal: ctl.signal, redirect: 'error' });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch (e) {}
    if (!r.ok) {
      const msg = (json && (json.error && (json.error.message || json.error) || json.message)) || text.slice(0, 200) || r.statusText;
      const e = new Error(`${r.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`); e.status = r.status; throw e;
    }
    return json != null ? json : { reply: text };
  } catch (e) {
    if (e.name === 'AbortError') throw new Error('The target took longer than 45 seconds.');
    throw e;
  } finally { clearTimeout(t); }
}

const BASES = { openai: 'https://api.openai.com/v1', xai: 'https://api.x.ai/v1' };

async function callTarget(target, system, prompt, origin) {
  const type = target.type;
  if (type === 'demo') {
    let out = null;
    require('./demo-agent')({ body: { system, message: prompt } }, { status() { return this; }, json(o) { out = o; } });
    return { reply: String((out && out.reply) || ''), usage: null };
  }
  if (type === 'endpoint') {
    const url = await safeUrl(target.url || '');
    const headers = target.key ? { authorization: 'Bearer ' + target.key } : {};
    const j = await post(url, headers, { message: prompt, system });
    const reply = typeof j === 'string' ? j : (j.reply ?? j.output ?? j.text ?? j.message ?? j.answer ?? (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content));
    if (reply == null) throw new Error('Your endpoint answered, but without a reply field (reply, output, text, message or answer).');
    return { reply: String(reply), usage: null };
  }
  if (!target.key) throw new Error('Add an API key for this target.');
  if (!target.model) throw new Error('Add a model name for this target.');
  if (type === 'anthropic') {
    const j = await post('https://api.anthropic.com/v1/messages', { 'x-api-key': target.key, 'anthropic-version': '2023-06-01' }, { model: target.model, max_tokens: 800, system, messages: [{ role: 'user', content: prompt }] });
    const reply = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
    return { reply, usage: j.usage ? { input: j.usage.input_tokens, output: j.usage.output_tokens } : null };
  }
  let base = BASES[type];
  if (type === 'compatible') base = (await safeUrl(target.baseUrl || '')).replace(/\/$/, '');
  if (!base) throw new Error('Unknown target type.');
  const j = await post(base + '/chat/completions', { authorization: 'Bearer ' + target.key }, { model: target.model, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] });
  const reply = j.choices && j.choices[0] && j.choices[0].message ? j.choices[0].message.content || '' : '';
  return { reply, usage: j.usage ? { input: j.usage.prompt_tokens, output: j.usage.completion_tokens } : null };
}

async function judge(judgeTarget, criterion, prompt, reply, origin) {
  const sys = 'You grade replies from an AI agent. Answer with JSON only: {"pass": true or false, "reason": "one short sentence"}.';
  const q = `User message:\n${prompt}\n\nAgent reply:\n${reply}\n\nPass only if this is true: ${criterion}`;
  const out = await callTarget(judgeTarget, sys, q, origin);
  const m = String(out.reply).match(/\{[\s\S]*\}/);
  try { const j = JSON.parse(m ? m[0] : out.reply); return { pass: !!j.pass, detail: String(j.reason || '').slice(0, 240) }; } catch (e) { return { pass: false, detail: 'The judge did not return a clear verdict.' }; }
}

function words(s) { return String(s).trim().split(/\s+/).filter(Boolean).length; }

async function score(checks, prompt, reply, judgeTarget, origin) {
  const out = [];
  for (const c of checks || []) {
    const v = c.value == null ? '' : String(c.value);
    let pass, detail;
    try {
      if (c.type === 'contains') { pass = reply.toLowerCase().includes(v.toLowerCase()); detail = pass ? `Found "${v}"` : `Missing "${v}"`; }
      else if (c.type === 'not_contains') { pass = !reply.toLowerCase().includes(v.toLowerCase()); detail = pass ? `Did not say "${v}"` : `Said "${v}"`; }
      else if (c.type === 'regex') { pass = new RegExp(v, 'i').test(reply); detail = pass ? 'Matched the pattern' : 'Did not match the pattern'; }
      else if (c.type === 'not_regex') { pass = !new RegExp(v, 'i').test(reply); detail = pass ? 'Avoided the pattern' : 'Matched a banned pattern'; }
      else if (c.type === 'max_words') { const n = words(reply); pass = n <= Number(v); detail = `${n} words (limit ${v})`; }
      else if (c.type === 'json') {
        const m = reply.match(/\{[\s\S]*\}/); let j = null; try { j = JSON.parse(m ? m[0] : reply); } catch (e) {}
        const keys = v.split(',').map((x) => x.trim()).filter(Boolean);
        pass = !!j && keys.every((k) => k in j); detail = !j ? 'Not valid JSON' : pass ? 'Valid JSON with the right keys' : `JSON is missing: ${keys.filter((k) => !(k in j)).join(', ')}`;
      }
      else if (c.type === 'judge') {
        if (!judgeTarget) { out.push({ type: c.type, value: v, pass: null, detail: 'Skipped: pick a judge model to score this' }); continue; }
        try { const r = await judge(judgeTarget, v, prompt, reply, origin); pass = r.pass; detail = r.detail; }
        catch (e) { out.push({ type: c.type, value: v, pass: null, detail: 'Not scored: the judge model returned an error (' + String(e.message).slice(0, 120) + ')' }); continue; }
      }
      else { pass = null; detail = 'Unknown check'; }
    } catch (e) { pass = false; detail = 'Check error: ' + e.message; }
    out.push({ type: c.type, value: v, pass, detail });
  }
  const scored = out.filter((x) => x.pass !== null);
  return { checks: out, pass: scored.length ? scored.every((x) => x.pass) : null };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.status(405).json({ error: 'POST only' }); return; }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const { target, test, judge: judgeTarget } = body || {};
  if (!target || !test || !test.prompt) { res.status(400).json({ error: 'Send a target and a test with a prompt.' }); return; }
  const prompt = String(test.prompt).slice(0, MAX_PROMPT);
  const system = String(test.system || '').slice(0, MAX_PROMPT);
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${req.headers['x-forwarded-host'] || req.headers.host}`;
  const t0 = Date.now();
  try {
    const out = await callTarget(target, system, prompt, origin);
    const latencyMs = Date.now() - t0;
    const s = await score(test.checks, prompt, out.reply || '', judgeTarget && judgeTarget.type ? judgeTarget : null, origin);
    res.status(200).json({ ok: true, reply: out.reply, latencyMs, usage: out.usage, checks: s.checks, pass: s.pass });
  } catch (e) {
    res.status(200).json({ ok: false, error: e.message || 'Something went wrong', latencyMs: Date.now() - t0 });
  }
};
