# Engineering Review

This assessment intentionally keeps ticket pull requests focused. The following production-readiness work is prioritized for a future iteration rather than being hidden inside unrelated changes.

| Priority | Finding | Impact | Recommended next step |
| --- | --- | --- | --- |
| P0 | No authentication or ownership boundary | Any client can read and modify all expenses and categories | Add authentication, associate records with an owner, and enforce authorization in every API action |
| P0 | CORS allows every origin | Any website can call the API from a browser | Use an environment-driven allowlist and verify production origins |
| P1 | Expense index is unbounded and pagination is client-only | Response time and memory grow with the full dataset | Add bounded server pagination with response metadata and rate limits |
| P1 | Frontend API origin is hard-coded | Non-local deployments call the wrong backend | Read a validated `VITE_API_URL` with a safe development fallback |
| P1 | Demo seed generation is random and destructive when run manually | Reset data cannot reproduce defects and erases local records | Move demo reset behind an explicit task and use a fixed random seed |
| P1 | Rails 7.2 support ends on August 9, 2026 | The backend will immediately lose maintained-framework coverage | Plan and test a Rails 8 upgrade before production deployment |
| P1 | Vite 5's development server has unresolved advisories | Exposing the development server can disclose local files | Keep development bound to trusted networks and upgrade Node/Vite in a dedicated compatibility change |
| P2 | Reusable fields and dialogs lack complete accessible semantics | Labels, errors, focus, and dialogs are harder to use with assistive technology | Add associated IDs, ARIA descriptions, focus management, and keyboard tests |

The current API also needs observability, structured error reporting, backup/recovery exercises, and deployment-specific secret management before production use.
