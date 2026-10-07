# Delta · Agent eval workbench

First demo of Delta: test suites for AI agents that run on every release, with pass rates, failure types and regressions, plus a release gate that blocks a bad build.

**What's in the demo**
- Overview per agent: release gate, pass rate, regressions, fixes, flaky tests, cost and latency
- Pass rate trend by release, suite-by-release heatmap, failure types
- Release detail: suite comparison with the previous release, filterable test results
- Test detail: input, expected behaviour, history across releases and the failing run's trace with the grader's verdict
- "Run evals" simulates a new release run end to end

Static site, no build step. Data is synthetic and deterministic (`data.js`).

Built by George Odiana · https://george-side-projects.vercel.app
