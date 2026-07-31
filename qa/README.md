# Adversarial Qualification Harness

This harness validates the combined assessment stack without changing PRs #1-#5. It uses an isolated Compose project, private network, non-default host ports, and an ephemeral MySQL volume.

## Safety contract

- Default targets are loopback only. Non-loopback traffic is rejected unless `QA_ALLOW_REMOTE=1` is explicitly set.
- Seed and chaos operations require `QA_EPHEMERAL_DATABASE=1` inside the isolated backend container.
- Cleanup is restricted to the validated `likhait_qa_<seed>` Compose project.
- The harness never reuses the application's normal Docker volume or the developer's existing containers.
- The `breakpoint` profile is informational. Its first capacity breach is evidence and does not relax CI thresholds.

## Requirements

- Docker with Compose
- Node.js 20 or newer
- `npm ci` in this directory
- `npx playwright install chromium` (use `--with-deps` on Linux CI)

## Commands

```text
npm run qa:smoke       # 1,000 rows, browser/API checks, two restart cycles, short k6 load
npm run qa:ci          # 10,000 rows, 25 restarts, chaos recovery, three 2-minute 40-RPS runs
npm run qa:full        # 100,000 rows, 25 restarts, chaos, ramp/spike, and 30-minute soak
npm run qa:breakpoint  # 50 -> 100 -> 150 -> 200 RPS capacity exploration
npm run qa:all         # smoke, CI, and full load against the 100,000-row dataset
```

Configuration:

| Variable | Default | Purpose |
| --- | --- | --- |
| `QA_SEED` | `20260801` | Deterministic data and isolated project suffix |
| `QA_TARGET_URL` | `http://127.0.0.1:3100` | Backend target alias when `QA_BACKEND_URL` is unset |
| `QA_UI_URL` | `http://127.0.0.1:5174` | Browser target |
| `QA_BACKEND_URL` | `http://127.0.0.1:3100` | Health target |
| `QA_API_URL` | `<backend>/api` | API target |
| `QA_RESTART_COUNT` | profile-dependent | Backend replacement repetitions |
| `QA_KEEP_STACK` | `0` | Set to `1` only for post-failure inspection |
| `QA_ALLOW_REMOTE` | `0` | Explicit opt-in required for any non-loopback target |

## Artifacts

Every run writes machine-readable evidence to `qa/artifacts/`: k6 summaries, resource samples, Playwright JUnit/HTML/traces, restart timings, adversarial API results, MySQL index/EXPLAIN output, Compose logs, chaos recovery timings, and the final status.

`PASS_WITH_PRODUCTION_BLOCKERS` means the assessment behaviors met their gates while the production blockers in `QUALIFICATION_REPORT.md` remain unresolved. It does not mean the application is production-ready.

## Capacity configuration

The isolated stack sets `WEB_CONCURRENCY=2` and keeps five threads per Puma
worker. Production operators should size workers against available CPU, memory,
and database connections instead of copying that value blindly. Expense JSON
responses use standard gzip content negotiation; the load profile advertises
`Accept-Encoding: gzip`, as production browsers do, and k6 validates the
decompressed response normally. Latency thresholds and correctness assertions
remain unchanged.
