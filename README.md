# Delta · Agent eval workbench

Demo of Delta: test suites for AI agents that run on every release, with pass rates, failure types, regressions and a release gate that blocks a bad build.

**Features**
- Eval dashboard per agent: regressions, test results donut, pass rate trend, suite overview, release gate, failure types, suite x release heatmap
- Releases and release detail with filters, suite comparison and CSV export
- Compare any two releases: pass rate, cost, latency, suite deltas, what broke and what got fixed
- Triage queue: owner, status and notes on every failing or flaky test
- Configurable release gate rules (max drop, pass-rate floor, critical suites, flaky blocking)
- Add your own test cases; they run in the next eval
- Run evals: simulated run of every case x 3, saved as a new release
- Cost and latency trends, test search (press /)

Static site, no build step. Demo data is synthetic (`data.js`); your changes are saved in the browser.

Built by George Odiana · https://george-side-projects.vercel.app
