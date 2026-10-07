# Delta · agent eval workbench

Test suites for AI agents, run on every release, with pass rates, failure types and regressions.

Live: https://delta-evals.vercel.app

## What's in it

- **Demo workspace** (`#/`): releases, suites, triage, failure types, cost and latency for three example agents, on fixed demo data.
- **Outside agents** (`#/outside`): your agent next to OpenAI GPT, xAI Grok, Anthropic Claude and Meta Llama on the same tests. Illustrative scores, not real benchmarks.
- **Live runner** (`#/live`): real tests against real models.
  - Targets: built-in demo agent (no key), OpenAI, Anthropic, xAI, any OpenAI-compatible API (e.g. Llama on Groq or Together), or your own HTTPS endpoint (`POST {"message","system"}`, returns `{"reply"}`).
  - Checks: contains, must not contain, regex, banned regex, max words, valid JSON with keys, and a judge model for things rules can't score.
  - 1 or 3 runs per test, regressions vs your last run, reply-level detail, CSV export.

## How it works

Static front end plus two Vercel functions:

- `api/run.js` sends one test to one target, scores the reply and returns the result. Keys come with each request and are never stored or logged. Private and non-https addresses are blocked.
- `api/demo-agent.js` is a small rule-based agent so anyone can try it without a key. It fails a few tests on purpose.

Tests, targets and run history live in the browser (localStorage). No accounts or database yet.

## Run locally

```
npx vercel dev
```

Then open http://localhost:3000/#/live
