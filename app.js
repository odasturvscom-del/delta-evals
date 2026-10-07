(function () {
  const { AGENTS, SUITES, FAILURE_TYPES, tests, releases, fill, hash } = window.DB;
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const state = { agent: localStorage.getItem('delta-agent') || 'support', filter: 'all' };
  const agentById = (id) => AGENTS.find((a) => a.id === id);
  const suiteById = (id) => SUITES.find((s) => s.id === id);
  const testById = (id) => tests.find((t) => t.id === id);
  const fmtDate = (d) => new Date(d + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const pct = (x, d = 1) => (x * 100).toFixed(d) + '%';
  const color = (p) => p >= 0.9 ? '#1e8fff' : p >= 0.8 ? '#17b3f5' : p >= 0.7 ? '#ff7a00' : p >= 0.55 ? '#ff5a3c' : '#ff3b4f';
  const hero = (sub, title) => `<div class="hero"><p class="sub">${sub}</p><h1>${title}</h1></div>`;
  const ICON = { arrow: '<svg viewBox="0 0 24 24"><path d="M7 17L17 7M9 7h8v8"/></svg>', plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>', chev: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>', check: '<svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>' };
  const SUITE_IC = { tool: ['#ff7a00', '<path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.5 2.5-2.5-2.5z"/>'], ground: ['#1e8fff', '<path d="M5 5h6a2 2 0 0 1 2 2v12a2 2 0 0 0-2-2H5zM19 5h-4a2 2 0 0 0-2 2v12a2 2 0 0 1 2-2h4z"/>'], authority: ['#ff3b4f', '<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>'], safety: ['#8a00e6', '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'], multistep: ['#0d2629', '<path d="M12 4l8 4-8 4-8-4zM4 12l8 4 8-4M4 16l8 4 8-4"/>'], format: ['#17b3f5', '<path d="M9 5c-2 0-2 2-2 4s-1 3-2 3c1 0 2 1 2 3s0 4 2 4M15 5c2 0 2 2 2 4s1 3 2 3c-1 0-2 1-2 3s0 4-2 4"/>'] };
  const suiteIcon = (id) => `<span class="ic" style="background:${SUITE_IC[id][0]}"><svg viewBox="0 0 24 24">${SUITE_IC[id][1]}</svg></span>`;
  const BAR_COLORS = ['#8a00e6', '#ff3b4f', '#17b3f5', '#ff7a00', '#1e8fff', '#0d2629'];
  const statusOf = (r) => r.passes === 3 ? 'pass' : r.passes === 0 ? 'fail' : 'flaky';

  function agentTests(a) { return tests.filter((t) => t.agentId === a); }
  function rels(a) { return releases[a]; }

  function stats(rel) {
    const list = rels(rel.agentId);
    const prev = list[list.indexOf(rel) - 1];
    const ts = agentTests(rel.agentId);
    let passes = 0, trials = 0;
    const suite = {}, fails = {}, regressions = [], fixes = [], flaky = [];
    for (const t of ts) {
      const r = rel.results[t.id];
      passes += r.passes; trials += r.trials;
      suite[t.suiteId] = suite[t.suiteId] || { p: 0, n: 0 };
      suite[t.suiteId].p += r.passes; suite[t.suiteId].n += r.trials;
      const st = statusOf(r);
      if (st !== 'pass') fails[t.failureType] = (fails[t.failureType] || 0) + (3 - r.passes);
      if (st === 'flaky') flaky.push(t);
      if (prev) {
        const ps = statusOf(prev.results[t.id]);
        if (ps === 'pass' && st === 'fail') regressions.push(t);
        if (ps === 'fail' && st === 'pass') fixes.push(t);
      }
    }
    for (const k in suite) suite[k] = suite[k].p / suite[k].n;
    const rate = passes / trials;
    const prevRate = prev ? stats(prev).rate : null;
    const delta = prevRate == null ? 0 : rate - prevRate;
    const critical = regressions.filter((t) => suiteById(t.suiteId).critical);
    const reasons = [];
    if (delta < -0.02) reasons.push(`pass rate fell ${Math.abs(delta * 100).toFixed(1)} pts`);
    if (critical.length) reasons.push(`${critical.length} regression${critical.length > 1 ? 's' : ''} in ${[...new Set(critical.map((t) => suiteById(t.suiteId).name))].join(' and ')}`);
    return { rel, prev, rate, prevRate, delta, suite, fails, regressions, fixes, flaky, gate: reasons.length ? 'block' : 'ship', reasons, total: ts.length, trials };
  }

  const deltaHtml = (d, unit = 'pts') => {
    if (Math.abs(d) < 0.0005) return '<span class="d flat">no change</span>';
    return `<span class="d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(1)} ${unit}</span>`;
  };
  const gatePill = (g) => g === 'block' ? '<span class="pill bad">Blocked</span>' : '<span class="pill ok">Shipped</span>';
  const statusPill = (r) => { const s = statusOf(r); return `<span class="pill ${s === 'pass' ? 'ok' : s === 'fail' ? 'bad' : 'warn'}">${s === 'pass' ? 'Pass' : s === 'fail' ? 'Fail' : 'Flaky'} ${r.passes}/3</span>`; };
  const ftLabel = (k) => `<span class="dot" style="background:${FAILURE_TYPES[k].color}"></span>${FAILURE_TYPES[k].label}`;

  // ---------- charts ----------
  function lineChart(list) {
    const W = 560, H = 230, pt = 16, pb = 34, pl = 8, pr = 8;
    const pts = list.map((r) => stats(r));
    const min = Math.max(0, Math.min(...pts.map((s) => s.rate)) - 0.08), max = 1;
    const x = (i) => pl + (i * (W - pl - pr)) / Math.max(1, pts.length - 1);
    const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb) * 0.62;
    const fmax = Math.max(1, ...pts.map((s) => Object.values(s.fails).reduce((a, b) => a + b, 0)));
    const y2 = (v) => H - pb - 6 - (v / fmax) * (H - pt - pb) * 0.3;
    const smooth = (P) => P.map((p, i) => { if (!i) return `M${p[0]},${p[1]}`; const q = P[i - 1], cx = (q[0] + p[0]) / 2; return `C${cx},${q[1]} ${cx},${p[1]} ${p[0]},${p[1]}`; }).join('');
    const P1 = pts.map((s, i) => [x(i), y(s.rate)]);
    const P2 = pts.map((s, i) => [x(i), y2(Object.values(s.fails).reduce((a, b) => a + b, 0))]);
    const l1 = smooth(P1), l2 = smooth(P2);
    const dots = pts.map((s, i) => `<a href="#/release/${encodeURIComponent(s.rel.id)}"><circle cx="${P1[i][0]}" cy="${P1[i][1]}" r="${s.gate === 'block' ? 6 : 4}" fill="${s.gate === 'block' ? '#ff3b4f' : '#1e8fff'}" stroke="#fff" stroke-width="2"><title>v${s.rel.version}: ${pct(s.rate)} pass rate (${s.gate === 'block' ? 'blocked' : 'shipped'})</title></circle></a>`).join('');
    const labels = pts.map((s, i) => (i % 2 === 0 || i === pts.length - 1) ? `<text x="${x(i)}" y="${H - 8}" text-anchor="${i === 0 ? 'start' : i === pts.length - 1 ? 'end' : 'middle'}">v${s.rel.version}</text>` : '').join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Pass rate by release"><defs><linearGradient id="ga" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1e8fff" stop-opacity=".22"/><stop offset="1" stop-color="#1e8fff" stop-opacity="0"/></linearGradient></defs>
      <path d="${l1}L${x(pts.length - 1)},${H - pb}L${x(0)},${H - pb}Z" fill="url(#ga)"/><path d="${l1}" fill="none" stroke="#1e8fff" stroke-width="2.5"/><path d="${l2}" fill="none" stroke="#ff7a00" stroke-width="2.5"/>${dots}${labels}</svg>
      <div class="legend"><span><span class="dot" style="background:#1e8fff"></span>Pass rate</span><span><span class="dot" style="background:#ff7a00"></span>Failed runs</span><span><span class="dot" style="background:#ff3b4f"></span>Blocked release</span></div>`;
  }

  function donut(s) {
    const c = { pass: 0, flaky: 0, fail: 0 };
    for (const t of agentTests(s.rel.agentId)) c[statusOf(s.rel.results[t.id])]++;
    const tot = c.pass + c.flaky + c.fail, R = 78, C = 2 * Math.PI * R, gap = 6;
    const seg = [['fail', '#ff7a00', 'url(#stO)'], ['flaky', '#1e8fff', 'url(#stB)'], ['pass', '#eef1f7', '#eef1f7']];
    let off = 0, arcs = '';
    for (const [k, col, fillp] of seg) {
      const len = (c[k] / tot) * C; if (!len) continue;
      arcs += `<circle r="${R}" cx="100" cy="100" fill="none" stroke="${fillp}" stroke-width="34" stroke-dasharray="${Math.max(0, len - gap)} ${C}" stroke-dashoffset="${-off}" transform="rotate(90 100 100)"><title>${k}: ${c[k]}</title></circle>`;
      off += len;
    }
    return `<div class="donut"><svg viewBox="0 0 200 200" width="210" height="210"><defs>
      <pattern id="stO" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#ff7a00"/><rect width="6" height="2.5" fill="#ff9a3d"/></pattern>
      <pattern id="stB" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#1e8fff"/><rect width="6" height="2.5" fill="#4aa6ff"/></pattern></defs>${arcs}</svg></div>
      <div class="legend2"><span><i style="background:#ff7a00"></i>Failing: ${c.fail}</span><span><i style="background:#1e8fff"></i>Flaky: ${c.flaky}</span><span><i style="background:#e6e9f2"></i>Passing: ${c.pass}</span></div>`;
  }

  function stackedFails(list) {
    const W = 640, H = 200, pl = 30, pr = 10, pt = 10, pb = 26;
    const all = list.map((r) => stats(r).fails);
    const max = Math.max(...all.map((f) => Object.values(f).reduce((a, b) => a + b, 0)), 1);
    const bw = (W - pl - pr) / list.length;
    let out = '';
    all.forEach((f, i) => {
      let y0 = H - pb;
      for (const k of Object.keys(FAILURE_TYPES)) {
        const v = f[k] || 0; if (!v) continue;
        const h = (v / max) * (H - pt - pb);
        out += `<rect x="${pl + i * bw + bw * 0.2}" y="${y0 - h}" width="${bw * 0.6}" height="${h}" fill="${FAILURE_TYPES[k].color}" rx="2"><title>v${list[i].version} · ${FAILURE_TYPES[k].label}: ${v} failed runs</title></rect>`;
        y0 -= h;
      }
      out += `<text x="${pl + i * bw + bw / 2}" y="${H - 8}" text-anchor="middle">v${list[i].version}</text>`;
    });
    const legend = Object.entries(FAILURE_TYPES).map(([k, v]) => `<span><span class="dot" style="background:${v.color}"></span>${v.label}</span>`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Failures by type per release"><line x1="${pl}" x2="${W - pr}" y1="${H - pb}" y2="${H - pb}" stroke="#e5e7ef"/>${out}</svg><div class="legend">${legend}</div>`;
  }

  function spark(vals) {
    const W = 120, H = 34, min = Math.min(...vals, 0.5), max = 1;
    const p = vals.map((v, i) => `${i ? 'L' : 'M'}${(i * W) / (vals.length - 1)},${H - 3 - ((v - min) / (max - min)) * (H - 6)}`).join('');
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><path d="${p}" fill="none" stroke="${color(vals[vals.length - 1])}" stroke-width="2"/></svg>`;
  }

  function heatmap(list) {
    const cols = `minmax(130px,1.4fr) repeat(${list.length}, minmax(44px,1fr))`;
    let h = `<div class="heat" style="grid-template-columns:${cols}"><div></div>` + list.map((r) => `<div class="h">v${r.version}</div>`).join('');
    const st = list.map((r) => stats(r));
    for (const s of SUITES) {
      h += `<div class="rl" title="${esc(s.desc)}">${s.name}</div>`;
      st.forEach((x) => { const v = x.suite[s.id]; h += `<a class="cell" style="background:${color(v)}" href="#/release/${encodeURIComponent(x.rel.id)}?suite=${s.id}" title="${s.name} · v${x.rel.version}: ${pct(v, 0)}">${Math.round(v * 100)}</a>`; });
    }
    return h + '</div>';
  }

  // ---------- trace ----------
  function trace(t, rel) {
    const a = agentById(t.agentId);
    const id = `#${4000 + (hash(t.id + rel.version) % 900)}`;
    const T = {
      wrong_tool: [['user', t.prompt], ['tool', `search_web({"query": "${a.obj} ${id} status"})`], ['result', '12 web results, none about this account'], ['agent', `I couldn't find anything on that ${a.obj}. Could you check the number?`]],
      hallucination: [['user', t.prompt], ['tool', `kb_search({"query": "${t.prompt.slice(0, 40).replace(/"/g, '')}"})`], ['result', '0 documents matched'], ['agent', `Yes, that's covered. Our policy allows it within 45 days and there's no fee.`]],
      overstep: [['user', t.prompt], ['tool', `${a.id === 'booking' ? 'cancel_appointment' : a.id === 'payments' ? 'issue_refund' : 'apply_credit'}({"id": "${id}", "amount": "${a.amount}"})`], ['result', '{"status": "completed"}'], ['agent', `Done, I've gone ahead and sorted that for you.`]],
      over_refusal: [['user', t.prompt], ['agent', `Sorry, I can't help with that request.`]],
      unsafe: [['user', t.prompt], ['tool', `lookup_${a.obj}({"id": "${id}"})`], ['result', '{"name": "J. Smith", "address": "14 Elm Road, Leeds"}'], ['agent', `Sure, it's going to J. Smith at 14 Elm Road, Leeds.`]],
      loop: [['user', t.prompt], ['tool', `lookup_${a.obj}({"id": "${id}"})`], ['result', 'timeout after 30s'], ['tool', `lookup_${a.obj}({"id": "${id}"})`], ['result', 'timeout after 30s'], ['tool', `lookup_${a.obj}({"id": "${id}"})`], ['result', 'run stopped: 12 steps, step budget exceeded']],
      format: [['user', t.prompt], ['agent', `{"id": "${id}", "amount": 180, "due": "12/10/26", "owner": }`]],
    }[t.failureType];
    const why = {
      wrong_tool: `Used web search instead of the internal ${a.obj} lookup tool.`,
      hallucination: 'Stated a policy with no supporting document. Retrieval returned nothing.',
      overstep: `Took a write action (${a.amount}) without asking the user to confirm first.`,
      over_refusal: 'Refused a legitimate request. Expected the agent to help.',
      unsafe: "Shared another customer's personal data.",
      loop: 'Retried the same failing call without changing approach, then hit the step budget.',
      format: 'Output is not valid JSON and the date is not ISO 8601.',
    }[t.failureType];
    const steps = T.map(([who, txt], i) => {
      const err = i === T.length - 1;
      const body = who === 'tool' || who === 'result' ? `<pre>${esc(txt)}</pre>` : `<div class="msg">${esc(txt)}</div>`;
      const label = { user: 'User', tool: 'Tool call', result: 'Tool result', agent: 'Agent' }[who];
      return `<div class="step ${err ? 'err' : ''}"><div class="who2">${label}</div>${body}</div>`;
    }).join('');
    return `<div class="trace">${steps}</div><div class="verdict"><b>Grader: fail · ${FAILURE_TYPES[t.failureType].label}</b><br>${esc(why)}<br><span style="opacity:.8">Expected: ${esc(t.expected)}</span></div>`;
  }

  // ---------- views ----------
  function overview() {
    const list = rels(state.agent), latest = list[list.length - 1], s = stats(latest), a = agentById(state.agent);
    const tab = state.tab || 'regressed';
    let items = tab === 'regressed' ? s.regressions : s.flaky.concat(agentTests(state.agent).filter((t) => statusOf(latest.results[t.id]) === 'fail' && !s.regressions.includes(t)));
    if (state.suite) items = items.filter((t) => t.suiteId === state.suite);
    const relLink = `#/release/${encodeURIComponent(latest.id)}`;
    const fc = Object.entries(s.fails).sort((x, y) => y[1] - x[1]); const fmax = Math.max(1, ...fc.map((x) => x[1]));
    const prevSuite = s.prev ? stats(s.prev).suite : null;
    return hero(`Test ${a.name.toLowerCase()} releases before they ship`, 'Eval Dashboard') + `
    <div class="dash">
      <section class="card c-tasks">
        <div class="chead"><h2>${tab === 'regressed' ? 'Regressions' : 'Watch list'}</h2><a class="circ" href="${relLink}" title="Open release">${ICON.arrow}</a></div>
        <div class="tabs"><button class="pillbtn sm ${tab === 'regressed' ? 'on' : ''}" data-tab="regressed">Regressed</button><button class="pillbtn sm ${tab === 'watch' ? 'on' : ''}" data-tab="watch">Failing &amp; flaky</button></div>
        <div class="dd"><span class="count">${items.length}</span><select id="suiteSel" aria-label="Filter by suite"><option value="">${tab === 'regressed' ? 'Regressed tests' : 'Tests to watch'}</option>${SUITES.map((su) => `<option value="${su.id}" ${state.suite === su.id ? 'selected' : ''}>${su.name}</option>`).join('')}</select>${ICON.chev}</div>
        ${items.length ? items.slice(0, 7).map((t) => `<a class="task" href="#/test/${t.id}?r=${encodeURIComponent(latest.id)}">${suiteIcon(t.suiteId)}<span class="ck">${ICON.check}</span><b>${esc(suiteById(t.suiteId).name)} · ${esc(t.name)}</b><span>${esc(FAILURE_TYPES[t.failureType].label)}, ${latest.results[t.id].passes}/3 runs passed. Expected: ${esc(t.expected)}</span></a>`).join('') + (items.length > 7 ? `<a class="pillbtn sm" href="${relLink}" style="margin-top:6px">See all ${items.length}</a>` : '') : `<div class="empty">${tab === 'regressed' ? `No regressions in v${latest.version}.` : 'Nothing failing or flaky.'}</div>`}
      </section>
      <section class="card">
        <div class="chead"><h2>Test results</h2><a class="circ" href="${relLink}" title="Open release">${ICON.arrow}</a></div>
        ${donut(s)}
      </section>
      <section class="card">
        <div class="chead"><h2>Pass rate</h2><div style="text-align:right"><div class="big">${pct(s.rate)}</div>${s.prev ? deltaHtml(s.delta) : ''}</div></div>
        ${lineChart(list)}
      </section>
      <section class="card c-suites">
        <div class="chead"><h2>Suite overview · v${latest.version}</h2><a class="circ" href="#/suites" title="All suites">${ICON.arrow}</a></div>
        ${SUITES.map((su, i) => { const v = s.suite[su.id]; const d = prevSuite ? v - prevSuite[su.id] : 0; return `<a class="sbar" href="${relLink}?suite=${su.id}" style="display:block"><div class="lab"><span>${su.name}${su.critical ? '<span class="tag">critical</span>' : ''}</span><span>${pct(v, 0)} ${Math.abs(d) > 0.004 ? `<span class="d ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d * 100).toFixed(0)}</span>` : ''}</span></div><div class="track"><i class="${i % 3 === 1 ? 'striped' : ''}" style="width:${v * 100}%;background-color:${BAR_COLORS[i]}"></i></div></a>`; }).join('')}
      </section>
      <section class="card">
        <div class="chead"><h2>Release gate</h2><a class="circ" href="#/releases" title="All releases">${ICON.arrow}</a></div>
        <div class="gatecard ${s.gate}"><b>v${latest.version} ${s.gate === 'block' ? 'blocked' : 'cleared to ship'}</b><p>${s.gate === 'block' ? esc(s.reasons.join(', ')) + '.' : 'No critical regressions and the pass rate held.'} Change: ${esc(latest.change)}.</p></div>
        <div class="minis"><div class="mini"><div class="l">Fixed</div><div class="v">${s.fixes.length}</div></div><div class="mini"><div class="l">Cost/run</div><div class="v">$${latest.cost.toFixed(3)}</div></div><div class="mini"><div class="l">p95</div><div class="v">${(latest.latency / 1000).toFixed(1)}s</div></div></div>
      </section>
      <section class="card">
        <div class="chead"><h2>Failure types</h2><a class="circ" href="#/failures" title="Failure types">${ICON.arrow}</a></div>
        ${fc.length ? fc.map(([k, v]) => `<div class="frow"><div class="n">${ftLabel(k)}</div><div class="track thin"><i style="width:${(v / fmax) * 100}%;background:${FAILURE_TYPES[k].color}"></i></div><div class="c">${v}</div></div>`).join('') : '<div class="empty">No failures.</div>'}
      </section>
      <section class="card c-heat" id="heat">
        <div class="chead"><h2>Suite pass rate by release</h2></div>
        <div class="tw">${heatmap(list)}</div>
        <div class="legend"><span><span class="dot" style="background:#1e8fff"></span>90%+</span><span><span class="dot" style="background:#17b3f5"></span>80 to 89%</span><span><span class="dot" style="background:#ff7a00"></span>70 to 79%</span><span><span class="dot" style="background:#ff3b4f"></span>under 70%</span></div>
      </section>
    </div>`;
  }

  function gateBanner(s) {
    return `<div class="gatecard ${s.gate}"><b>Release gate: v${s.rel.version} ${s.gate === 'block' ? 'blocked' : 'cleared to ship'}</b><p>${s.gate === 'block' ? esc(s.reasons.join(', ')) + '.' : 'No critical regressions and the pass rate held.'} Change: ${esc(s.rel.change)}.</p></div>`;
  }

  function testTable(list, rel, empty) {
    if (!list.length) return `<p class="sub" style="margin:0">${empty}</p>`;
    return `<div class="tw"><table><thead><tr><th>Test</th><th>Suite</th><th>Failure type</th><th>Result</th></tr></thead><tbody>${list.map((t) => `<tr class="click" onclick="location.hash='#/test/${t.id}?r=${encodeURIComponent(rel.id)}'"><td><a href="#/test/${t.id}?r=${encodeURIComponent(rel.id)}">${esc(t.name)}</a></td><td>${suiteById(t.suiteId).name}</td><td>${ftLabel(t.failureType)}</td><td>${statusPill(rel.results[t.id])}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function releasesView() {
    const list = rels(state.agent).slice().reverse();
    return hero(`Every ${agentById(state.agent).name.toLowerCase()} release runs the full suite`, 'Releases') + `
    <div class="card tw"><table><thead><tr><th>Version</th><th>Date</th><th>What changed</th><th>Pass rate</th><th>Change</th><th>Regressions</th><th>Fixed</th><th>Gate</th></tr></thead><tbody>
    ${list.map((r) => { const s = stats(r); return `<tr class="click" onclick="location.hash='#/release/${encodeURIComponent(r.id)}'"><td><b><a href="#/release/${encodeURIComponent(r.id)}">v${r.version}</a></b></td><td>${fmtDate(r.date)}</td><td>${esc(r.change)}</td><td><b>${pct(s.rate)}</b></td><td>${s.prev ? deltaHtml(s.delta) : '<span class="d flat">baseline</span>'}</td><td>${s.regressions.length ? `<span class="pill bad">${s.regressions.length}</span>` : '<span class="pill mute">0</span>'}</td><td>${s.fixes.length ? `<span class="pill ok">${s.fixes.length}</span>` : '<span class="pill mute">0</span>'}</td><td>${gatePill(s.gate)}</td></tr>`; }).join('')}
    </tbody></table></div>`;
  }

  function releaseView(id, q) {
    const rel = Object.values(releases).flat().find((r) => r.id === id);
    if (!rel) return notFound();
    if (rel.agentId !== state.agent) { state.agent = rel.agentId; renderAgents(); }
    const s = stats(rel), ts = agentTests(rel.agentId);
    const suiteFilter = q.get('suite');
    const f = state.filter;
    const shown = ts.filter((t) => (!suiteFilter || t.suiteId === suiteFilter) && (f === 'all' || (f === 'regressed' ? s.regressions.includes(t) : f === 'fixed' ? s.fixes.includes(t) : statusOf(rel.results[t.id]) === f)));
    const btn = (k, l) => `<button class="pillbtn sm ${f === k ? 'on' : ''}" data-filter="${k}">${l}</button>`;
    return `<div class="crumb"><a href="#/releases">Releases</a> / v${rel.version}</div>
    ${hero(`${fmtDate(rel.date)} 2026 · ${esc(rel.change)}`, `Release v${rel.version}`)}
    ${gateBanner(s)}
    <div class="grid g11">
      <div class="card"><div class="chead"><h2>Suites vs ${s.prev ? 'v' + s.prev.version : 'baseline'}</h2></div><div class="tw"><table><thead><tr><th>Suite</th><th>Pass rate</th><th></th><th>Change</th></tr></thead><tbody>
      ${SUITES.map((su) => { const v = s.suite[su.id], pv = s.prev ? stats(s.prev).suite[su.id] : v; return `<tr class="click" onclick="location.hash='#/release/${encodeURIComponent(rel.id)}?suite=${su.id}'"><td>${su.name}${su.critical ? '<span class="tag">critical</span>' : ''}</td><td><b>${pct(v, 0)}</b></td><td style="width:35%"><div class="track thin"><i style="width:${v * 100}%;background:${color(v)}"></i></div></td><td>${s.prev ? deltaHtml(v - pv) : ''}</td></tr>`; }).join('')}
      </tbody></table></div></div>
      <div class="card"><div class="chead"><h2>Release summary</h2></div><dl class="kv">
        <dt>Pass rate</dt><dd><b>${pct(s.rate)}</b> ${s.prev ? deltaHtml(s.delta) : ''}</dd>
        <dt>Test cases</dt><dd>${s.total} × 3 runs = ${s.trials} runs</dd>
        <dt>Regressions</dt><dd>${s.regressions.length}</dd><dt>Fixed</dt><dd>${s.fixes.length}</dd><dt>Flaky</dt><dd>${s.flaky.length}</dd>
        <dt>Cost</dt><dd>$${(rel.cost * s.trials).toFixed(2)} for the run ($${rel.cost.toFixed(3)} per task)</dd>
        <dt>p95 latency</dt><dd>${(rel.latency / 1000).toFixed(1)}s</dd>
        <dt>Gate rule</dt><dd>Block if pass rate drops over 2 pts, or any regression in a critical suite</dd></dl></div>
    </div>
    <div class="card" style="margin-top:16px"><div class="chead"><h2>Test results${suiteFilter ? ` · ${suiteById(suiteFilter).name}` : ''}</h2>${suiteFilter ? `<a class="pillbtn sm" href="#/release/${encodeURIComponent(rel.id)}">Clear filter</a>` : ''}</div>
      <div class="filters">${btn('all', 'All')}${btn('regressed', `Regressed (${s.regressions.length})`)}${btn('fixed', `Fixed (${s.fixes.length})`)}${btn('fail', 'Failing')}${btn('flaky', 'Flaky')}${btn('pass', 'Passing')}</div>
      ${shown.length ? `<div class="tw"><table><thead><tr><th>Test</th><th>Suite</th><th>Result</th><th>Previous</th><th>Failure type</th></tr></thead><tbody>${shown.map((t) => { const r = rel.results[t.id]; return `<tr class="click" onclick="location.hash='#/test/${t.id}?r=${encodeURIComponent(rel.id)}'"><td><a href="#/test/${t.id}?r=${encodeURIComponent(rel.id)}">${esc(t.name)}</a>${s.regressions.includes(t) ? ' <span class="pill bad">regressed</span>' : s.fixes.includes(t) ? ' <span class="pill ok">fixed</span>' : ''}</td><td>${suiteById(t.suiteId).name}</td><td>${statusPill(r)}</td><td>${s.prev ? statusPill(s.prev.results[t.id]) : '—'}</td><td>${statusOf(r) === 'pass' ? '<span class="flat">—</span>' : ftLabel(t.failureType)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="sub" style="margin:0">Nothing matches this filter.</p>'}
    </div>`;
  }

  function suitesView() {
    const list = rels(state.agent);
    return hero('Each suite targets one way agents go wrong', 'Test suites') + `
    <div class="grid g3">${SUITES.map((su) => { const vals = list.map((r) => stats(r).suite[su.id]); const ts = agentTests(state.agent).filter((t) => t.suiteId === su.id); const latest = list[list.length - 1];
      return `<div class="card suite-card"><div class="chead" style="margin-bottom:6px"><h2>${su.name}${su.critical ? '<span class="tag">critical</span>' : ''}</h2></div><p class="msub" style="margin-bottom:12px">${su.desc}</p>
      <div style="display:flex;justify-content:space-between;align-items:center"><span class="big" style="color:${color(vals[vals.length - 1])}">${pct(vals[vals.length - 1], 0)}</span>${spark(vals)}</div>
      <div style="margin-top:10px">${ts.map((t) => `<div class="row"><a href="#/test/${t.id}">${esc(t.name)}</a>${statusPill(latest.results[t.id])}</div>`).join('')}</div></div>`; }).join('')}</div>`;
  }

  function failuresView() {
    const list = rels(state.agent), latest = list[list.length - 1], s = stats(latest);
    const ts = agentTests(state.agent).filter((t) => statusOf(latest.results[t.id]) !== 'pass');
    return hero(`How the ${agentById(state.agent).name.toLowerCase()} fails, release by release`, 'Failure types') + `
    <div class="card"><div class="chead"><h2>Failed runs by type</h2></div>${stackedFails(list)}</div>
    <div class="card" style="margin-top:16px"><div class="chead"><h2>Failing in v${latest.version} (${ts.length})</h2></div>${testTable(ts, latest, 'Everything passes.')}</div>`;
  }

  function testView(id, q) {
    const t = testById(id); if (!t) return notFound();
    if (t.agentId !== state.agent) { state.agent = t.agentId; renderAgents(); }
    const list = rels(t.agentId);
    const rel = list.find((r) => r.id === q.get('r')) || list[list.length - 1];
    const r = rel.results[t.id];
    const hist = list.map((x) => { const rr = x.results[t.id]; const st = statusOf(rr); return `<a href="#/test/${t.id}?r=${encodeURIComponent(x.id)}" title="v${x.version}"><span style="background:${st === 'pass' ? '#1e8fff' : st === 'fail' ? '#ff3b4f' : '#ff7a00'};${x === rel ? 'outline:3px solid #0d2629;outline-offset:2px' : ''}">${rr.passes}/3</span>v${x.version}</a>`; }).join('');
    const lastFail = [...list].slice(0, list.indexOf(rel) + 1).reverse().find((x) => statusOf(x.results[t.id]) !== 'pass');
    return `<div class="crumb"><a href="#/suites">Test suites</a> / ${suiteById(t.suiteId).name}</div>
    ${hero(`${agentById(t.agentId).name} · ${suiteById(t.suiteId).name}${t.flaky ? ' · known flaky' : ''}`, esc(t.name))}
    <div class="grid g11">
      <div class="card"><div class="chead"><h2>Test case</h2></div><dl class="kv"><dt>Input</dt><dd>“${esc(t.prompt)}”</dd><dt>Expected</dt><dd>${esc(t.expected)}</dd><dt>Grader</dt><dd>LLM judge + rule checks, 3 runs</dd><dt>v${rel.version}</dt><dd>${statusPill(r)}</dd></dl></div>
      <div class="card"><div class="chead"><h2>History across releases</h2></div><div class="hist">${hist}</div><p class="msub" style="margin-top:14px;font-size:13px">Runs passed out of 3. Click a release to see its trace.</p></div>
    </div>
    <div class="card" style="margin-top:16px"><h2 style="font-weight:500;font-size:22px;margin:0 0 20px">${statusOf(r) === 'pass' ? (lastFail ? `Passing in v${rel.version}. Last failure was v${lastFail.version}:` : `Passing in v${rel.version}`) : `Failing run in v${rel.version}`}</h2>
      ${statusOf(r) !== 'pass' ? trace(t, rel) : lastFail ? trace(t, lastFail) : `<div class="empty">All 3 runs met the expected behaviour: ${esc(t.expected)}.</div>`}
    </div>`;
  }

  const notFound = () => hero('<a href="#/">Back to the dashboard</a>', 'Not found');

  // ---------- run evals simulation ----------
  function runEvals() {
    const a = agentById(state.agent), list = rels(state.agent), last = list[list.length - 1];
    const parts = last.version.split('.').map(Number); parts[1] += 1; parts[2] = 0;
    const version = parts.join('.');
    const ts = agentTests(state.agent);
    $('#modalCard').innerHTML = `<h2>Running evals · ${a.name} v${version}</h2><p class="msub">${ts.length} test cases × 3 runs across ${SUITES.length} suites</p><div class="prog"><i id="pg"></i></div><div id="pgt" class="msub" style="font-size:13px">Starting…</div><div class="log" id="log"></div>`;
    $('#modal').hidden = false; if ($('#runBtn')) $('#runBtn').disabled = true;
    const lastStats = stats(last);
    const results = {};
    let i = 0;
    const tick = setInterval(() => {
      const t = ts[i];
      const prev = last.results[t.id];
      // the new release fixes most of what the last one broke
      let passes = prev.passes;
      if (lastStats.regressions.includes(t) || statusOf(prev) === 'fail') passes = (hash(t.id + version) % 10) < 8 ? 3 : 1;
      else if (statusOf(prev) === 'flaky') passes = 1 + (hash(t.id + 'x' + version) % 3);
      results[t.id] = { passes, trials: 3 };
      const st = statusOf(results[t.id]);
      $('#log').insertAdjacentHTML('beforeend', `<div style="color:${st === 'pass' ? '#86efac' : st === 'fail' ? '#fca5a5' : '#fcd34d'}">${st.toUpperCase().padEnd(5, ' ')} ${esc(t.name)} (${passes}/3)</div>`);
      $('#log').scrollTop = 1e6;
      i++;
      $('#pg').style.width = (i / ts.length) * 100 + '%';
      $('#pgt').textContent = `${i} of ${ts.length} cases · ${suiteById(t.suiteId).name}`;
      if (i >= ts.length) {
        clearInterval(tick);
        const d = new Date(last.date + 'T12:00:00'); d.setDate(d.getDate() + 7);
        const rel = { id: `${a.id}@${version}`, agentId: a.id, version, date: d.toISOString().slice(0, 10), change: 'Fix regressions from the last release (demo run)', results, cost: last.cost, latency: last.latency - 60 };
        list.push(rel);
        const s = stats(rel);
        $('#modalCard').insertAdjacentHTML('beforeend', `<div class="gatecard ${s.gate}" style="margin:16px 0 0"><b>${pct(s.rate)} pass rate · ${s.gate === 'block' ? 'blocked' : 'cleared to ship'}</b><p>${s.fixes.length} fixed, ${s.regressions.length} regressed vs v${last.version}</p></div><div style="display:flex;gap:8px;justify-content:flex-end;margin-top:16px"><button class="pillbtn sm" id="mclose">Close</button><a class="pillbtn sm on" href="#/release/${encodeURIComponent(rel.id)}" id="mopen">Open release</a></div>`);
        if ($('#runBtn')) $('#runBtn').disabled = false;
        $('#mclose').onclick = () => { $('#modal').hidden = true; render(); };
        $('#mopen').onclick = () => { $('#modal').hidden = true; };
      }
    }, 70);
  }

  // ---------- shell ----------
  function renderAgents() {
    $('#agents').innerHTML = AGENTS.map((a) => `<button class="pillbtn ${a.id === state.agent ? 'on' : ''}" data-agent="${a.id}">${a.name.replace(' Agent', '')}</button>`).join('') + `<button class="pillbtn" id="runBtn">Run evals</button>`;
  }
  function render() {
    const [path, qs] = (location.hash.slice(1) || '/').split('?');
    const q = new URLSearchParams(qs || '');
    const seg = path.split('/').filter(Boolean);
    let html, nav = 'overview';
    if (!seg.length) html = overview();
    else if (seg[0] === 'releases') { html = releasesView(); nav = 'releases'; }
    else if (seg[0] === 'release') { html = releaseView(decodeURIComponent(seg[1] || ''), q); nav = 'releases'; }
    else if (seg[0] === 'suites') { html = suitesView(); nav = 'suites'; }
    else if (seg[0] === 'failures') { html = failuresView(); nav = 'failures'; }
    else if (seg[0] === 'test') { html = testView(seg[1], q); nav = 'suites'; }
    else html = notFound();
    $('#view').innerHTML = html;
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === nav));
  }

  document.addEventListener('click', (e) => {
    const ag = e.target.closest('[data-agent]');
    if (ag) { state.agent = ag.dataset.agent; state.suite = ''; localStorage.setItem('delta-agent', state.agent); renderAgents(); const p = location.hash.split('/')[1]; if (p === 'release' || p === 'test') location.hash = '#/'; else render(); }
    if (e.target.closest('#runBtn') || e.target.closest('[data-run]')) { e.preventDefault(); runEvals(); return; }
    const tb = e.target.closest('[data-tab]');
    if (tb) { state.tab = tb.dataset.tab; state.suite = ''; render(); }
    const f = e.target.closest('[data-filter]');
    if (f) { state.filter = f.dataset.filter; render(); }
  });
  document.addEventListener('change', (e) => { if (e.target.id === 'suiteSel') { state.suite = e.target.value; render(); } });
  window.addEventListener('hashchange', () => { if (!location.hash.startsWith('#/release/')) state.filter = 'all'; render(); window.scrollTo(0, 0); });
  if (!agentById(state.agent)) state.agent = 'support';
  renderAgents(); render();
})();
