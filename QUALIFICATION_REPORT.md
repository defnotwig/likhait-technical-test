# PR #1-#5 Qualification Report

## Executive decision

**Classification: PASS_WITH_PRODUCTION_BLOCKERS — production readiness is not claimed.**

The combined candidate passed correctness, concurrency, restart, database-recovery, browser, accessibility, static-analysis, resource-limit, and 40-request-per-second CI capacity checks with 10,000 expenses. All three required load repetitions passed the original thresholds with no dropped arrivals, unexpected responses, or 5xx responses. No threshold was relaxed.

The initial combined run exposed response-transfer saturation. The remediation keeps the API response contract intact, enables gzip negotiation at the Rack boundary, and allows Puma process concurrency through `WEB_CONCURRENCY`. The isolated qualification environment exercises two Puma workers. The final exact head is recorded in the PR and its GitHub Actions evidence.

## Immutable PR inputs

| PR | Head SHA | Role |
| --- | --- | --- |
| #1 | `afd2ea7073706d50d2877c4fbb1ecca08f722def` | CI and quality foundation |
| #2 | `04d9ef9212f4d2b7901576a272d5c61d9e27268d` | Docker restart reliability |
| #3 | `bdd25c40a6888751da7f7099b1803eff3762ad78` | Dynamic category management |
| #4 | `b182026529f5c899347fd6a06f7324e766700092` | Expense-date ordering and filtering |
| #5 | `74827d96e4df37d262c7ca50fe15aae6955ebd30` | Future-date protection |

The qualification branch starts from PR #3 and integrates PRs #4 and #5 without changing or rewriting their heads.

## Environment

| Item | Value |
| --- | --- |
| Executed | 2026-08-01 Asia/Taipei (2026-07-31 UTC artifact timestamps) |
| Host | Windows, Docker Desktop Linux containers |
| Docker Engine / Compose | 29.5.3 / 5.1.4 |
| Node / npm | 22.14.0 / 10.9.2 locally; workflow pins Node 20 |
| Backend / database | Ruby 3.3.7, Rails 7.2.3, MySQL 8.0 |
| Browser | Playwright 1.62.1 Chromium, desktop and Pixel 7 profiles |
| Load generator | `grafana/k6:1.3.0` |
| Seed | `20260801` |
| Isolation | Dedicated `likhait_qa_20260801` Compose project and disposable MySQL volume |

## Results

### Static and automated checks

| Gate | Result |
| --- | --- |
| RSpec | PASS — 33 examples, 0 failures |
| RuboCop | PASS — 33 files, 0 offenses |
| Brakeman 8.0.5 | REVIEWED — 0 errors, 1 medium Rails maintenance warning |
| Vitest | PASS — 7 files, 15 tests |
| TypeScript/Vite build | PASS — 169.01 kB JavaScript, 53.37 kB gzip |
| Frontend audit | BLOCKER — 1 high and 1 moderate advisory; automatic remediation requires a major Vite upgrade |
| Qualification-package audit | PASS — 0 vulnerabilities |
| Compose configuration | PASS |

### Correctness and abuse resistance

The CI profile seeded exactly 10,000 deterministic expenses. All 17 adversarial API scenarios passed:

- 100 concurrent case/whitespace variants produced exactly one `201` and 99 controlled `422` responses.
- 100 unique Unicode categories returned `201`.
- 100 concurrent future creates and 100 concurrent future updates all returned `422`.
- Rejected updates left the stored row unchanged; today remained valid.
- Scaled monthly results were date-descending, including boundary fixtures.
- Malformed JSON and missing roots returned controlled `400` responses.
- Invalid/incomplete year-month parameters and overlong descriptions returned controlled `422` responses.
- A one-megabyte description was rejected, and an SQL-like category name remained inert.
- The monthly query stayed at a constant eager-loaded query count in request specs.

`SHOW INDEX` exposed `index_expenses_on_date`. MySQL `EXPLAIN` selected that index for the monthly range query, while also reporting `Using filesort` for the deterministic multi-column order.

### Browser and accessibility

All four Playwright tests passed across desktop Chromium and the Pixel 7 mobile profile. Evidence covered category creation, immediate form availability, expense creation, category editing, refresh persistence, deletion, direct future-date API rejection, form-value preservation, one category fetch per page load, and zero uncaught browser/page errors.

The critical page and dialog scans reported zero serious or critical Axe violations. Each measured initial critical navigation satisfied the enforced two-second assertion. The suite had no retry-classified flake.

### Recovery and fault injection

| Gate | Result |
| --- | --- |
| Backend force-recreate | PASS — 25/25 |
| Recovery minimum / average / maximum | 6.510 s / 8.431 s / 11.242 s |
| Stale PID, manual cleanup, exited container | None observed |
| MySQL pause recovery | PASS — 5.202 s |
| MySQL restart recovery | PASS — 4.153 s |
| Post-fault fixture integrity | PASS |

The cold-volume harness initially exposed a MySQL initialization race in which its temporary bootstrap server satisfied the container health check. The backend startup now performs bounded `db:prepare` retries and fails after 60 seconds rather than hanging or requiring manual intervention.

### Load and resource evidence

The final workload performs exactly one HTTP request per arrival-rate iteration. Its mix is 80% indexed monthly reads and 20% create/update/delete mutations. Expected `422` abuse traffic is measured separately and is not counted as an unexpected failure.

| Metric | Gate | Observed | Result |
| --- | ---: | ---: | --- |
| Read p95 | < 750 ms | 30.5-33.9 ms | PASS |
| Read p99 | < 1,500 ms | 40.0-255.4 ms | PASS |
| Mutation p95 | < 1,000 ms | 7.6-11.6 ms | PASS |
| Mutation p99 | < 2,000 ms | 11.5-35.0 ms | PASS |
| Dropped arrivals | 0 | 0 in all repetitions | PASS |
| Unexpected responses | 0% | 0% | PASS |
| Unexpected 5xx | 0 | 0 | PASS |
| Correctness checks | 100% | 3,901/3,901 per repetition | PASS |
| Completed arrivals | Scheduled profile | 3,899 per repetition | PASS |
| Backend peak memory | < 512 MiB | 410.7 MiB | PASS |
| MySQL peak memory | < 1 GiB | 392.0 MiB | PASS |

The original failure transferred approximately 480 MB in one repetition and saturated 100 virtual users. With standards-compliant gzip negotiation, each passing repetition transferred approximately 40-41 MB and used at most eight virtual users while preserving the same JSON representation after decompression. Optional Puma process concurrency prevents CPU-heavy response work from being restricted to one CRuby Global VM Lock. A regression request spec validates gzip headers and decompressed content.

## Stop-rule disposition

- All three 10,000-row CI repetitions passed the unchanged thresholds.
- The 100,000-row full profile and 30-minute soak were not part of this bounded CI remediation rerun and remain manual qualification work.
- The breakpoint profile remains informational and was not required to clear the CI gate.
- No threshold was changed, waived, or reclassified.
- Exact-head and combined GitHub Actions results are recorded against the latest pushed PR head.

## Production blockers

1. **P0 — no authentication or tenant isolation.** Every caller can read and modify every record.
2. **P0 — wildcard CORS and no rate limiting.** Any origin can call an API without a client consumption boundary.
3. **P1 — unbounded expense responses.** Pagination, record limits, and resource controls are required before production use even though the declared CI capacity now passes.
4. **P1 — frontend dependency advisories.** The available automatic audit fix requires a reviewed major Vite upgrade.
5. **P1 — framework maintenance.** Brakeman reports that Rails 7.2.3 support ends on 2026-08-09.
6. **P1 — health semantics.** `/up` proves process boot, not database readiness; database-backed readiness should be separate.

Authentication, pagination/resource limits, restrictive CORS, rate limiting, the Rails upgrade, and the Vite major upgrade remain separately reviewed production work. They were not smuggled into the assessment tickets.

## Reproduction and evidence

```text
cd qa
npm ci
npx playwright install chromium
npm run qa:smoke
npm run qa:ci
```

Each run writes k6 summaries, resource samples, Playwright JUnit/HTML/traces, restart timings, adversarial API results, MySQL index/`EXPLAIN` output, Compose logs, chaos timings, and final status to `qa/artifacts/`. GitHub Actions uploads the same directory even on failure.

## Final checklist

- [x] Fresh-volume smoke profile
- [x] Deterministic 10,000-row CI seed
- [x] 25 backend replacement cycles
- [x] Database pause/restart recovery within 30 seconds
- [x] 100-way category uniqueness race
- [x] 100-way future create/update rejection races
- [x] Desktop and mobile Chromium critical journeys
- [x] Zero serious/critical Axe violations in tested critical surfaces
- [x] Indexed monthly `EXPLAIN` evidence
- [x] Resource peaks below declared limits
- [x] Three consecutive CI load repetitions
- [ ] 100,000-row full profile and 30-minute soak — manual profile not run in this remediation
- [ ] Breakpoint profile — informational profile not run
- [x] Exact-head GitHub matrix — previous immutable-head matrix passed; latest-head rerun linked in PR
- [x] Combined-stack GitHub job — latest-head result linked in PR
