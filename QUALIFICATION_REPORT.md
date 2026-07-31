# PR #1-#5 Qualification Report

## Executive decision

**Classification: FAIL — production readiness is not claimed.**

The combined candidate passed correctness, concurrency, restart, database-recovery, browser, accessibility, static-analysis, and resource-limit checks. It did not meet the declared 40-request-per-second CI latency/capacity gate with 10,000 expenses. The harness exited nonzero on the first of three required repetitions. In accordance with the stop rules, the longer full/soak and higher breakpoint profiles were not run, and no threshold was relaxed.

Candidate application and harness commit tested: `f67474eae794389f898d8c0dc1f6caa2c7b3a851`. This report is a documentation-only follow-up to that candidate tree.

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
| RSpec | PASS — 32 examples, 0 failures |
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
| Recovery minimum / average / maximum | 8.684 s / 8.829 s / 9.985 s |
| Stale PID, manual cleanup, exited container | None observed |
| MySQL pause recovery | PASS — 5.211 s |
| MySQL restart recovery | PASS — 4.199 s |
| Post-fault fixture integrity | PASS |

The cold-volume harness initially exposed a MySQL initialization race in which its temporary bootstrap server satisfied the container health check. The backend startup now performs bounded `db:prepare` retries and fails after 60 seconds rather than hanging or requiring manual intervention.

### Load and resource evidence

The final workload performs exactly one HTTP request per arrival-rate iteration. Its mix is 80% indexed monthly reads and 20% create/update/delete mutations. Expected `422` abuse traffic is measured separately and is not counted as an unexpected failure.

| Metric | Gate | Observed | Result |
| --- | ---: | ---: | --- |
| Read p95 | < 750 ms | 4,080.6 ms | FAIL |
| Read p99 | < 1,500 ms | 4,173.3 ms | FAIL |
| Mutation p95 | < 1,000 ms | 3,857.1 ms | FAIL |
| Mutation p99 | < 2,000 ms | 3,943.3 ms | FAIL |
| Dropped arrivals | 0 | 860 | FAIL |
| Unexpected responses | 0% | 0% | PASS |
| Unexpected 5xx | 0 | 0 | PASS |
| Correctness checks | 100% | 3,041/3,041 | PASS |
| Completed request rate | 40 RPS target | 25.26 RPS | FAIL |
| Backend peak memory | < 512 MiB | 243.9 MiB | PASS |
| MySQL peak memory | < 1 GiB | 403.9 MiB | PASS |

The run transferred 409,657,722 response bytes across 3,041 requests and saturated the configured 100 virtual users. This is consistent with the known unbounded-list risk: the tested month returned 835 expense rows per read, so serialization and response transfer dominate even though the date range uses an index. That causal statement is an evidence-based inference; application profiling would be the next step before selecting an optimization.

## Stop-rule disposition

- CI repetition 1 exited with k6 code 99; repetitions 2 and 3 were not started.
- The 100,000-row full profile and 30-minute soak were not started because the lower 10,000-row CI gate had already failed.
- The breakpoint profile was not started because saturation occurred at 40 RPS, below its first 50-RPS stage.
- No failed threshold was changed, waived, or reclassified.
- Exact-head and combined GitHub Actions results remain pending until the qualification branch is pushed. The combined load job is expected to remain red unless the capacity blocker is remediated.

## Production blockers

1. **P0 — no authentication or tenant isolation.** Every caller can read and modify every record.
2. **P0 — wildcard CORS and no rate limiting.** Any origin can call an API without a client consumption boundary.
3. **P0 — capacity gate failure.** The service cannot sustain the declared 40-RPS CI profile within latency and dropped-arrival limits.
4. **P1 — unbounded expense responses.** Pagination, record limits, and resource controls are required before production use.
5. **P1 — frontend dependency advisories.** The available automatic audit fix requires a reviewed major Vite upgrade.
6. **P1 — framework maintenance.** Brakeman reports that Rails 7.2.3 support ends on 2026-08-09.
7. **P1 — health semantics.** `/up` proves process boot, not database readiness; database-backed readiness should be separate.

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
- [ ] Three consecutive CI load repetitions — stopped after repetition 1 failed
- [ ] 100,000-row full profile and 30-minute soak — blocked by CI failure
- [ ] Breakpoint profile — unnecessary after breach below its first stage
- [ ] Exact-head GitHub matrix — pending push
- [ ] Combined-stack GitHub job — pending push and expected to expose the capacity failure
