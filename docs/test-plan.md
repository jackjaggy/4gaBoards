# Test Plan: 4GA Boards

## 1. Overview

**Application Under Test (AUT).** 4GA Boards is an open-source, self-hostable Trello-style project-management app. It is delivered as a pnpm monorepo with three runtime artifacts:

| Artifact | Stack | Surface |
|---|---|---|
| `client/` | React 18 SPA, Redux + Redux-Saga + Redux-ORM, custom Webpack | Browser UI at `http://localhost:3000` |
| `server/` | Sails.js 1.x on Node 24, Waterline + Knex on PostgreSQL, `sails-hook-sockets` | REST API + WebSocket gateway under `/api/*`, OAuth callbacks under `/auth/*`, file routes under `/attachments/*`, `/exports/*` |
| `packages/` | `@4gaboards/enums`, `@4gaboards/locales` (16 languages), `@4gaboards/utils` | Built artifacts consumed by both runtimes |

**Mission of this plan.** Provide a risk-based test strategy that (a) gives the team a clear picture of *current* coverage vs. *required* coverage, (b) prioritises the next ~24 e2e specs to write, and (c) defines the criteria under which a release of 4GA Boards is considered shippable.

**Source of requirements.** No external requirements document exists. Functional intent has been derived from:
- `server/config/routes.js` (44 endpoints across 25 resource groups) and the helpers in `server/api/helpers/`.
- `server/api/models/` (22 Waterline models) and the mirrored `client/src/models/` (Redux-ORM).
- `client/src/components/` (~100 component directories) and `client/src/sagas/core/services/socket.js` (44 WebSocket event handlers).
- The existing Playwright suite at `tests/tests/e2e/`.

**Existing automated coverage (current baseline).** 7 spec files; **30 active tests** (41 authored, 11 deactivated as out-of-layer per §3.6); chromium-only, `workers: 1`, fully serial:

| Spec | Active | Authored | Surface |
|---|---:|---:|---|
| `auth/auth.spec.ts` | 4 | 6 | login form render, login happy-path, invalid credentials, logout (2 empty-submission guards deactivated) |
| `board/kanban.spec.ts` | 6 | 12 | list add/rename/delete, card add/rename/delete (4 empty-name guards + 2 cancel-confirmation guards deactivated) |
| `board/comments.spec.ts` | 3 | 6 | comment add/edit/delete (2 empty-text guards + 1 cancel-confirmation guard deactivated) |
| `board/board-view.spec.ts` | 4 | 4 | Kanban ↔ List View toggle, reload resets to default Kanban |
| `board/card-move.spec.ts` | 5 | 5 | within-list reorder (DnD), cross-list move ×2 (DnD, single + multi-step), persist-on-reload, cross-board via popup |
| `board/list-reorder.spec.ts` | 4 | 4 | drag right ×1, drag right ×2, drag left ×1, persist-on-reload (all rbd keyboard sensor) |
| `card-modal/task-reorder.spec.ts` | 4 | 4 | drag down, drag-to-bottom, drag-to-top, persist-on-reload (rbd keyboard sensor inside modal) |

Coverage is **roughly 15% of the user-facing feature surface** (estimate: 30 of ~200 testable user journeys), up from 8% — the addition of three DnD specs lands the highest-value E2E-only category (cross-layer drag flows that no other test level can reach). The 11 deactivated tests are commented out (not deleted) inside their spec files with a header rationale block, so the code is preserved for either re-activation or migration to component-level Jest. The infrastructure is in good shape — POM, custom fixtures, API-driven setup via `ApiClient.bootstrapBoard*` (now with multi-list / two-board / card-with-tasks variants), cascade-delete cleanup — so the priority remains breadth, not refactor.

## 2. Scope

### 2.1 In-Scope

| Area | Specifically covers |
|---|---|
| **Authentication** | Local login/logout, registration, email verification, password change, username change, email change, account lockout (rate-limit on failed auth) |
| **Authorisation** | Project Manager vs. project member; Board Membership roles `editor` vs. `viewer`; `canComment` flag; admin-only routes (`users.*`, `core.update`, `api-clients.*`) |
| **Project lifecycle** | Create / rename / delete, background gradient & image upload, project members, "Import getting-started" template |
| **Board lifecycle** | Create / rename / delete, board memberships, **export** (JSON), **import** from Trello and from 4ga JSON, GitHub repo flag, mail tokens |
| **List & card CRUD** | Lists (add/rename/delete/collapse/reorder), Cards (add/rename/edit description/move within list/move across lists/move across boards/duplicate/delete) |
| **Card details** | Description (edit/live/preview modes), due date, timer, cover image, members, labels, tasks (subtasks), attachments, comments, activity feed, subscriptions |
| **Search & filter** | Sidebar project/board filter, in-board card search (`query`, `matchCase`, `anyMatch`), filter by member / label / due date / notification state |
| **Drag & drop** | Reorder lists, reorder cards in a list, move cards across lists, move cards across boards, reorder tasks in a card, reorder boards in sidebar |
| **Notifications** | In-app notification center, badge count, mark read / mark all read, delete / delete all, filter; user preferences for subscriptions and email delivery mode |
| **Real-time / WebSocket** | Two-tab parity for cardCreate / cardUpdate / cardDelete / cardMove, listCreate/Update/Delete, commentCreate/Update/Delete, attachmentCreate/Update/Delete, taskCreate/Update/Delete, membership changes, label changes; reconnect-after-disconnect |
| **i18n** | Language switch from `en` → at least one RTL-leaning and one CJK locale (e.g. `de`, `ja`); missing-key detection via `pnpm client:ci:test` in CI |
| **Settings** | Profile, Preferences (theme/shape/font/view defaults), Authentication, Account, Notifications, Instance, Users, Project Settings |
| **Admin** | User CRUD, API client CRUD with secret reveal, instance settings (registration enabled, SSO enabled, allowed register domains), mail tokens |
| **Files** | Attachment upload (image + non-image), thumbnail generation, download with permission check, set as cover, attachment delete; avatar upload; project background image upload |
| **Accessibility** | WCAG 2.1 AA on the five most-trafficked pages: `/login`, `/`, `/projects/:id`, `/boards/:id`, `/cards/:id` modal |
| **Performance (smoke)** | Time-to-interactive on `/boards/:id` for boards with 1, 50, and 500 cards; WebSocket message throughput on a 5-user concurrent edit |
| **Security** | OWASP ASVS L1: authN bypass, IDOR (`viewer` writes via API, cross-project resource access by ID), file-upload abuse, SSRF in OIDC discovery URL, session token TTL, rate-limit effectiveness, attachment download leakage |

### 2.2 Out of Scope (and why)

| Area | Reason |
|---|---|
| OAuth callback flows for Google / GitHub / Microsoft / OIDC | Require external IdP credentials and per-environment redirect-URI registration. Will be **stubbed at the Passport layer** in integration tests; **deferred** for full e2e until a sandbox tenant per provider is provisioned. Documented as risk **R-04**. |
| External email delivery | Outbound mail goes through a separate "Notifications" microservice (`NOTIFICATIONS_HOST_URL`). E2E will assert that a `Notification` row is created and `deliveredAt` is set by the cron — not that an SMTP message landed in a real inbox. |
| Inbound email → card creation (mail tokens) | Requires a configured inbound MX. Tested at the API/helper level only (`mail-tokens/get-list-id`). |
| Mobile native browsers (iOS Safari, Android Chrome) | Project is desktop-first; `playwright.config.ts` is chromium-only. Add as separate plan when responsive layouts harden. |
| Load / soak / chaos testing | Out-of-band engagement; not part of release-gate. Will be revisited if/when a public SaaS instance is launched. |
| Visual regression | Defer until Chromatic / Percy-style budget exists. The app's animation-heavy drag & drop makes naive screenshot diffs noisy. |

### 2.3 Assumptions

- The demo seed (`pnpm server:db:init`) is the canonical starting state for both manual and automated testing.
- `demo` / `demo` user has admin-equivalent rights on the seed project; tests that need a non-admin / non-manager / `viewer` user must create them via API.
- Stack is brought up out-of-band before `pnpm test:e2e` (the script does not start anything itself — confirmed in `package.json` and `CLAUDE.md`).
- `.playwright-mcp` traces in the repo root are debug artifacts and are not part of the test suite.

## 3. Test Strategy

### 3.1 Approach

Risk-based pyramid, weighted toward integration and e2e because the application's value lives in the orchestration of WebSocket + REST + ORM + UI:

```
            /\          ~30  e2e (Playwright, chromium)
           /  \         ~80  API/integration (mocha + supertest, server-side)
          /    \       ~250  unit (jest client-side, mocha server-side helpers)
         /______\
```

### 3.2 Test design techniques applied

| Technique | Where it applies |
|---|---|
| **Equivalence partitioning** | Email format, username chars, password strength buckets, label color enum, board role enum |
| **Boundary value analysis** | Username length (3 / 16), password zxcvbn score (1 / 2 / 3), card position (gap-based reorder boundaries), attachment size, comment length |
| **Decision tables** | Login (account state × password × MFA-future), registration (registration enabled × local registration enabled × allowed domain list × email match), card edit (role × `canComment` × ownership) |
| **State transition** | Card subscription (off → auto-subscribe-on-create → manual unsubscribe → re-subscribe-on-comment); Notification (created → in-app read → email delivered → deleted) |
| **Pairwise** | Theme × shape × font × default view; locale × notification delivery mode |
| **Exploratory charters** | Drag & drop edge cases, simultaneous multi-tab edits, OIDC custom-claim mappings |

### 3.3 Tooling decisions

| Layer | Tool | Rationale |
|---|---|---|
| Unit (client) | Jest (already wired via `client/scripts/test.js`) | Existing |
| Unit (server) | Mocha (already wired in `server/test/utils/`) | Existing |
| Integration (server API) | Mocha + supertest under `server/test/integration/` | Existing pattern; covers the helpers without spinning a browser |
| E2E | Playwright (`tests/tests/e2e/`) | Existing; extend with the spec backlog in §10 |
| Accessibility | `@axe-core/playwright` injected into a single `axe.spec.ts` per route | Adds to existing fixture model with no new tooling |
| API contract | Reuse `tests/utils/api-client.ts` and grow it; consider a generated OpenAPI snapshot if schema drift becomes a problem |
| Visual / snapshot | None for now (see §2.2) |
| Performance | Lighthouse CI for `/login`, `/` and a representative `/boards/:id`; Playwright trace + custom timer for "time-to-interactive after socket hydration" |
| Security | `npm audit` / `pnpm audit` in CI, plus a one-off OWASP ZAP baseline scan against the running stack each release |

### 3.4 Test data strategy

- **Demo user** for tests that don't care about role nuance.
- **`viewer-bot`, `editor-bot`, `manager-bot`, `admin-bot`** seeded once per CI run via API. Adds four `Credentials` constants to `tests/utils/test-data.ts`.
- **Per-test isolation** via `bootstrappedBoard` fixture (already in place at `tests/fixtures/test.fixture.ts:63`): create project → use → cascade delete. Continue this pattern.
- **Unique names** via `uniqueName(NamePrefixes.*)` to avoid cross-test pollution when serial execution becomes parallel later.

### 3.5 Concurrency posture

`playwright.config.ts` currently sets `fullyParallel: false, workers: 1`. The recommendation is to **keep this for now** — the dev stack is single-Postgres and the cron-driven notification batcher is timing-sensitive — but add a `parallel` project for read-only smoke tests once the suite passes 50 specs.

### 3.6 Test layering policy (what does NOT belong in E2E)

Eleven previously-authored E2E tests have been deactivated (commented out, not deleted) because they failed the test-architect smell check for E2E-tier tests. They are:

- **8 client-side input-validation guards** — empty/whitespace rejection on `Login`, `AddList`, `AddCard`, and `CommentEdit` forms (`auth.spec.ts` × 2, `kanban.spec.ts` × 4, `comments.spec.ts` × 2).
- **3 ConfirmDialog cancel-wiring tests** — Delete List / Delete Card / Delete Comment "cancel preserves entity" (`kanban.spec.ts` × 2, `comments.spec.ts` × 1).

**Rationale (documented in each spec file's header comment):**

1. **Single-component scope.** Behaviour under test is owned by one React form component or by the generic `ConfirmDialog` wrapper — no saga, REST, WebSocket, or DB involvement. Pushing this to a Jest unit test on `LoginForm`, `AddListPopup`, `AddCardPopup`, `CommentEdit`, or `ConfirmDialog` runs in milliseconds, is deterministic, and pinpoints regressions to the offending component.
2. **Negative-existence assertion is structurally flake-prone.** Each deactivated test calls `page.waitForRequest(matcher, { timeout: 1000 }).catch(() => null)` and asserts the result is `null`. This asserts "no request fired in 1 s," not "no request will ever fire" — a buggy implementation that delays the request to t = 1.1 s passes silently. The pattern is bounded by a wall clock, which is the wrong shape for a never-fires assertion.
3. **Already covered indirectly.** Every happy-path CRUD test in the same files exercises the form → saga → API wiring. A regression that broke client-side validation at the saga or API layer would surface there as a 4xx/5xx response, caught by the existing success assertions.

**The cost:** 11 × full browser boot + board-fixture API setup + teardown ≈ ~5–6 minutes of CI wall-clock plus an ongoing flake budget — for tests that the next layer below would handle better.

**Where these belong instead:** `client/src/components/<Component>/__tests__/` Jest specs. Migration of these 11 tests to Jest is tracked as a follow-up under §11 deliverables.

**Smell checklist (apply when authoring new specs):**
- ❌ Does the assertion only verify a button-disabled / form-validation state? → unit test.
- ❌ Does the test rely on the *absence* of a network request inside a fixed time window? → unit test.
- ❌ Is the entire causal chain inside one React component file? → unit test.
- ✅ Does the flow cross saga / REST / WebSocket / DB? → keep at E2E.
- ✅ Does the assertion require optimistic-update-vs-server-state reconciliation (e.g. a reload-persistence check)? → keep at E2E.
- ✅ Does the flow involve drag-and-drop, real-time multi-tab, or browser session/cookie state? → keep at E2E (only layer that can verify it).

## 4. Test Types and Levels

| Level | Owner | Trigger | Pass bar |
|---|---|---|---|
| **Unit (client)** | Dev (TDD) | Pre-commit (`lint-staged`) + CI | 80% line coverage on `client/src/sagas/core/services/`, `client/src/utils/`, `client/src/selectors/` |
| **Unit (server)** | Dev | CI | 80% line coverage on `server/api/helpers/**/*.js` |
| **Integration (server)** | Dev / QA | CI | 100% endpoint coverage for happy-path, ≥1 negative case per endpoint |
| **E2E** | QA | CI on `main`, nightly on `develop` | All P1/P2 specs green; flaky retry budget ≤ 1 |
| **Accessibility** | QA | Nightly | Zero serious/critical axe violations on the five canonical routes |
| **Performance smoke** | QA | Nightly | p95 TTI < 3 s on `/boards/:id` with 50 cards on Apple M1-class hardware |
| **Security** | QA + Security | Per-release | Zero ZAP High; npm audit zero High; manual IDOR sweep on three endpoints (see §8 R-02) |

## 5. Entry and Exit Criteria

### 5.1 Entry criteria for a test run
- [ ] `pnpm i && pnpm packages:build` succeeds.
- [ ] Postgres is up (`docker compose -f docker-compose-dev.yml up -d`).
- [ ] `pnpm server:db:init` has been run for fresh DBs; otherwise `pnpm server:db:migrate`.
- [ ] `pnpm dev` is up; `curl -fsS http://localhost:3000/api/core-settings-public` returns 200 with a JSON body.
- [ ] `pnpm lint` is green (root) — gates only because the harness's lint-staged pre-commit doesn't catch unstaged drift.
- [ ] Demo user (`demo`/`demo`) exists and the `DD` initials are visible in the avatar (per `tests/utils/test-data.ts:19`).

### 5.2 Exit criteria for a release
- [ ] All P1 (must-have) e2e specs in §10 are green for two consecutive nightly runs.
- [ ] Zero open Critical bugs; zero open High bugs without an explicit owner + ETA.
- [ ] Server unit coverage ≥ 80%, client unit coverage ≥ 70% (lower because of view-layer noise).
- [ ] `pnpm client:ci:test` reports zero missing locale keys (the project already uses this as a translations gate per `CLAUDE.md`).
- [ ] One full pass of the **Risk Mitigation Checklist** in §8 (manual exploratory).
- [ ] Accessibility: zero serious/critical axe violations on `/login`, `/`, `/projects/:id`, `/boards/:id`, card-modal.
- [ ] Security: ZAP baseline scan with zero High; manual IDOR check on attachments, board export, and card show is signed off.
- [ ] Release notes drafted with the locale, schema-migration, and feature-flag matrix (per `CLAUDE.md`'s monorepo layout).

## 6. Test Environment

| Environment | Purpose | URL pattern | Data |
|---|---|---|---|
| **Local dev** | Developer iteration | `http://localhost:3000` (Webpack dev server, proxies to Sails on `:1337`) | `pnpm server:db:init` seed |
| **CI ephemeral** | Per-PR e2e | `http://localhost:3000` inside a GitHub Actions runner with `docker-compose-dev.yml` | Seed re-applied per job |
| **Staging** | Pre-release smoke | TBD (project does not currently publish a staging URL — flag for ops) | Anonymised production-shape data; rotate weekly |
| **Production** | Smoke + synthetic monitoring only | TBD | Real users — read-only synthetic monitors |

Browsers: **Chromium latest only** for now (per `playwright.config.ts`). Add Firefox + WebKit projects when the suite stabilises; defer as risk **R-05** to avoid scope creep on the first iteration.

Node / pnpm versions are pinned by `devEngines` in the root `package.json` (Node `^24.11`, pnpm `^10.33`). CI must enforce these or the WebSocket transport behaviour will diverge.

## 7. Test Data Requirements

### 7.1 Seeded fixtures (one-time per environment)

| Entity | Count | Notes |
|---|---|---|
| Users | 5 | `demo` (existing), plus `admin-bot`, `manager-bot`, `editor-bot`, `viewer-bot` |
| Projects | 2 | one owned by `manager-bot`, one owned by `demo` |
| Boards | 4 | "Empty board", "Board with 50 cards", "Board with imported Trello data", "Read-only board for viewer-bot" |
| Labels | full color palette (25) on one board for label-picker tests |
| Attachments | 3 (one image PNG, one image with thumbnail-failure trap like 0-byte, one PDF) |

### 7.2 Synthesised per-test (via `ApiClient`)

- One project + one board per spec via `bootstrappedBoard` fixture (already exists).
- Cards / lists / comments / attachments via API helpers to be added to `tests/utils/api-client.ts` — see §11 deliverables.

### 7.3 PII / secrets posture

- No production data may be loaded into staging without anonymisation.
- OAuth client secrets, `NOTIFICATIONS_CLIENT_SECRET`, and DB credentials are loaded from `.env` and **must never** be committed; CI must read them from secrets store.
- Avatar uploads in tests use a fixed checked-in `tests/fixtures/files/avatar.png`; do not generate from user-controlled input.

## 8. Risk Analysis

Likelihood (L) and Impact (I) on a 1–3 scale; Score = L × I. Priority bands: ≥ 6 High, 4–5 Medium, < 4 Low.

| ID | Risk | L | I | Score | Mitigation |
|---|---|---|---|---|---|
| **R-01** | **Authorisation drift** — a `viewer` is allowed to write via the API even though the UI hides the button. The codebase enforces RBAC inside helpers (e.g. `users/is-board-member.js`); a single missing check in a new helper is enough to leak. | 3 | 3 | **9** | API-level negative tests for every mutating endpoint as **viewer**, **non-member**, **non-manager**. Codify in `tests/utils/api-client.ts` so the same fixture is reused for UI and API tests. |
| **R-02** | **IDOR on attachment download / board export** — `/attachments/:id/download/:filename` and `/exports/:id/:filename` rely on permission checks at the route handler. A bug means cross-project file leakage. | 2 | 3 | **6** | Dedicated security spec: log in as `user-a`, attempt to download an attachment whose card belongs to `user-b`. Repeat for board export. Repeat for thumbnail download path. |
| **R-03** | **Cascade-delete corruption** — `delete-one.js` for project / board / list relies on Waterline associations + `Archive` model. A miss leaves orphan rows that hydrate the SPA into an inconsistent state and crash sagas. | 2 | 3 | **6** | Server integration tests assert: deleting a project leaves zero rows in `Board`, `List`, `Card`, `Task`, `Comment`, `Attachment`, `BoardMembership`, `Action` keyed to it (matched against `Archive` snapshots). |
| **R-04** | **OAuth callback regressions** untestable without IdP sandbox. Any change in `server/strategies/` could silently break SSO for a whole tenant. | 2 | 3 | **6** | Mock Passport strategy at the helper level: tests for `users/get-create-one-for-google-sso.js`, `…-github-sso.js`, `…-microsoft-sso.js`, `…-oidc-sso.js` with both "new user" and "existing-user-link" branches. Add a single manual smoke per provider per release. |
| **R-05** | **Browser-only chromium coverage** — Safari WebKit's WebSocket and IndexedDB behaviour differs; users on Safari may hit issues we never see. | 2 | 2 | 4 | Add WebKit project to `playwright.config.ts` for the smoke-tier specs (login, board view) once suite stabilises. |
| **R-06** | **Drag & drop position math** — gap-based positions in `insertToPositionables.js` accumulate floating-point error after enough reorders. The bug doesn't surface until ~2^16 reorders. | 1 | 3 | 3 | Server unit test: reorder 10⁵ times in a tight loop, assert positions remain monotonic. Cheap; do it once. |
| **R-07** | **WebSocket race conditions** — two tabs editing the same card; last-write-wins on `cards/update-one.js` could overwrite a sibling field if the client sends the whole record. | 3 | 2 | **6** | Multi-tab e2e: open same card in two browser contexts, edit `name` in tab A and `description` in tab B simultaneously, assert both survive. |
| **R-08** | **Notification email batcher** (`cron-notifications-batching`) drops notifications on a deploy if the cron fires mid-shutdown. | 2 | 2 | 4 | Mocha test that simulates `Notification.deliveredAt = null` rows and runs the batcher in dev mode (1-minute interval per `CLAUDE.md`); assert idempotency on a second invocation. |
| **R-09** | **Board import (Trello / 4ga JSON)** — malformed JSON or oversized payload could crash the server or corrupt a project. | 2 | 3 | **6** | Negative-input fixtures: empty board, board with 10k cards, malformed JSON, JSON with missing required fields. |
| **R-10** | **i18n key drift** — French/CJK strings exceed component widths and clip; missing keys fall back silently. | 3 | 1 | 3 | Run `pnpm client:ci:test` in CI as a translations gate (already documented in `CLAUDE.md`). Spot-check three locales visually per release. |
| **R-11** | **Rate-limit bypass** — `cron-failed-auths-cleanup` runs every 30 min; a misconfigured `AUTH_RATE_LIMIT_WINDOW_MS` could make the lockout never trigger. | 1 | 3 | 3 | Server integration test: 6 failed logins in 60 s → 6th returns 429 (or whatever Sails returns). |
| **R-12** | **File-upload abuse** — no documented file-type or size limit on `attachments/create-one.js`. | 2 | 2 | 4 | Negative tests: upload a 100 MB file, upload an `.exe`, upload a zip-bomb, attempt path traversal in filename. |
| **R-13** | **DnD timing fragility** — `pressDragSequence` in `tests/pages/board.page.ts:256-264` and `card-modal.page.ts:170-182` uses `waitForTimeout(60)` between rbd keyboard-sensor steps. Works on a fast dev machine; will start flaking on a loaded GitHub Actions runner where the React commit phase between keystrokes can exceed 60 ms. | 2 | 2 | 4 | Replace the fixed sleep with `page.waitForFunction` that polls rbd's `data-rbd-drag-handle-context-id` / `aria-roledescription` state, OR sniff the `[data-rbd-announcement]` live region for the lift / move announcements. Defer until the first CI flake materialises; document the trade. |
| **R-14** | **Negative-existence assertion pattern** — `waitForRequest(..., {timeout: 1000}).catch(() => null)` was used in 11 deactivated tests (see §3.6). Future authors may copy the pattern; it asserts "no request in 1 s" not "no request ever." | 2 | 2 | 4 | Anti-pattern is now documented in §3.6 smell checklist. If a legitimate "must not fire" assertion is needed at E2E level, route via Playwright's `page.route(matcher, route => route.abort())` and assert no abort triggered, OR mock the endpoint server-side and assert call count after the user action settles. |

## 9. Test Schedule and Estimation

Three-point estimation in person-days, single QA + dev support. Formula: (O + 4·M + P) / 6.

| Activity | O | M | P | Estimate | Status |
|---|---|---|---|---|---|
| Test design — flesh out scenarios in §10 to executable specs | 3 | 5 | 9 | **5.3** | 🟡 ~30% delivered (DnD + view-toggle done) |
| Extend `ApiClient` with helpers for Card / List / Task / Comment / Attachment / Membership / Project Manager / Board Membership | 2 | 3 | 5 | **3.2** | 🟡 ~50% delivered (List/Card/Task + layout bootstraps done; Comment/Attachment/Membership pending) |
| Build POMs for `CardModal`, `Settings/*`, `NotificationCenter`, `Sidebar`, `Filters` | 3 | 5 | 8 | **5.2** | 🟡 ~30% delivered (`CardModalPage` + DnD coverage; rest pending) |
| Author P1 specs (auth completion, RBAC, drag & drop, real-time multi-tab, attachments) | 5 | 8 | 14 | **8.5** → **~6.0 remaining** | 🟡 DnD chunk delivered; auth-completion / RBAC / realtime / attachments still pending |
| Migrate 11 deactivated guards to component-level Jest | 1 | 2 | 3 | **2.0** (new line item) | ⬜ Pending; pure component tests, no fixture work |
| Author P2 specs (settings, notifications, search/filter, board import) | 4 | 6 | 10 | **6.3** | 🟡 task-reorder chunk of #14 delivered; rest pending |
| Server integration tests for §8 risk mitigations | 3 | 5 | 9 | **5.3** | ⬜ Pending — also absorbs the API-half of P1 #4 / #5 / #10 per §10.4 notes |
| Wire axe-core into Playwright; author 5 a11y specs | 1 | 2 | 4 | **2.2** | ⬜ Pending |
| Wire Lighthouse CI for the three pages | 1 | 1.5 | 3 | **1.7** | ⬜ Pending |
| CI: add nightly e2e job, retry budget, trace upload | 1 | 2 | 4 | **2.2** | ⬜ Pending |
| Replace DnD `waitForTimeout(60)` with rbd-state polling (R-13) | 0.5 | 1 | 2 | **1.1** (new line item) | ⬜ Pending; defer until first CI flake materialises |
| Bug verification + retest buffer | 2 | 4 | 8 | **4.3** | rolling |
| Test reporting + release sign-off | 0.5 | 1 | 2 | **1.1** | rolling |
| **Total (revised)** | | | | **~46 days authored, ~9 days delivered, ~37 days remaining** |  |

Delivered work to date: ~3 specs (13 active tests), partial ApiClient + POM extensions, global setup/teardown, layering policy. Remaining ~37 person-days = roughly **7.5 calendar weeks** with one QA, **4 calendar weeks** with two — slightly ahead of the original projection on infrastructure, slightly behind on spec breadth (9 P1+P2 specs still owe).

## 10. Coverage Matrix

### 10.1 Functional requirements (derived from code, since no spec doc exists)

Derived requirements use the prefix `FR-` and trace back to the source endpoint or component.

| ID | Requirement | Source | Priority |
|---|---|---|---|
| **Auth** | | | |
| FR-A01 | Local user can log in with email/username + password | `POST /api/access-tokens` | P1 |
| FR-A02 | After 5 failed logins in 60 s the next attempt is rate-limited | `cron-failed-auths-cleanup`, `policies/rate-limit-auth.js` | P1 |
| FR-A03 | A new user registers with email, username, password (zxcvbn ≥ 2) | `POST /api/register` | P1 |
| FR-A04 | Email verification required before login completes | `users/request-email-verification.js` | P2 |
| FR-A05 | User can change password (requires old password) | `PATCH /api/users/:id/password` | P1 |
| FR-A06 | User can change email (requires verification of new address) | `PATCH /api/users/:id/email` | P2 |
| FR-A07 | User can change username (regex `^[a-zA-Z0-9]+((_|\.)?[a-zA-Z0-9])*$`, 3–16) | `PATCH /api/users/:id/username` | P2 |
| FR-A08 | OAuth: Google / GitHub / Microsoft / OIDC create or link a user | `server/strategies/*` | P2 |
| FR-A09 | Logout invalidates the session token | `DELETE /api/access-tokens/me` | P1 |
| **RBAC** | | | |
| FR-R01 | Project Manager may add/remove other managers | `POST/DELETE /api/projects/:id/managers` | P1 |
| FR-R02 | Board Editor may CRUD lists/cards/labels; Viewer may not | `BoardMembership.role` | P1 |
| FR-R03 | Viewer with `canComment=true` may post comments | `BoardMembership.canComment` | P2 |
| FR-R04 | Admin (`isAdmin`) may CRUD users and update core settings | `policies/is-admin.js` | P1 |
| FR-R05 | Non-member receives 403 on every mutation/read of a board | All `helpers/*/get-project-path.js` | P1 |
| **Project** | | | |
| FR-P01 | Create / rename / delete project | `projects/*-one.js` | P1 |
| FR-P02 | Set project background (gradient or image) | `projects/update-background-image.js` | P2 |
| FR-P03 | "Import getting-started" populates a sample board | `projects/import-getting-started.js` | P3 |
| **Board** | | | |
| FR-B01 | Create / rename / delete board, reorder via drag | `boards/*-one.js` | P1 |
| FR-B02 | Export board to JSON (admin/manager only?) | `boards/export.js` | P2 |
| FR-B03 | Import board from Trello JSON | `boards/import-from-trello.js` | P2 |
| FR-B04 | Import board from 4ga JSON | `boards/import-from-boards.js` | P3 |
| FR-B05 | Toggle Kanban ↔ List view | `Board/ListView` component | P2 (covered ✅) |
| **List & Card** | | | |
| FR-L01 | List CRUD + reorder | `lists/*-one.js` | P1 (CRUD covered ✅, reorder gap) |
| FR-C01 | Card CRUD | `cards/*-one.js` | P1 (CRUD covered ✅) |
| FR-C02 | Move card within a list | `cards/update-one.js` (position) | P1 |
| FR-C03 | Move card to another list (same board) | `cards/update-one.js` (listId) | P1 |
| FR-C04 | Move card to another board | `cards/update-one.js` (boardId) | P1 |
| FR-C05 | Duplicate card with all subresources | `POST /api/cards/:id/duplicate` | P2 |
| FR-C06 | Set due date / clear due date | `cards/update-one.js` (dueDate) | P2 |
| FR-C07 | Start / pause / reset stopwatch timer | `cards/update-one.js` (timer) | P3 |
| FR-C08 | Set / unset cover image | `attachments/update-one.js` | P3 |
| FR-C09 | Subscribe / unsubscribe to card | `CardSubscription` | P3 |
| **Tasks** | | | |
| FR-T01 | Add / rename / complete / uncomplete / delete task | `tasks/*-one.js` | P1 |
| FR-T02 | Reorder tasks by drag within card | `tasks/update-one.js` (position) | P2 |
| FR-T03 | Assign / unassign user to a task | `task-memberships/*` | P3 |
| **Labels** | | | |
| FR-LB01 | Create label with color, edit, delete | `labels/*-one.js` | P2 |
| FR-LB02 | Assign / unassign label on card | `card-labels/*` | P2 |
| **Members** | | | |
| FR-M01 | Add / remove board member, set role | `board-memberships/*` | P1 |
| FR-M02 | Assign / unassign user to card | `card-memberships/*` | P2 |
| **Comments** | | | |
| FR-CM01 | Add / edit / delete comment (covered ✅) | `comments/*-one.js` | P1 |
| FR-CM02 | Comment supports markdown + linkification | `LinkifiedTextRenderer` | P2 |
| FR-CM03 | Mention notifies mentioned user (`@username`) | `comments/create-one.js`, `actions/CARD_COMMENT_CREATE` | P2 |
| **Attachments** | | | |
| FR-AT01 | Upload image attachment, thumbnail generated | `attachments/process-uploaded-file.js` | P1 |
| FR-AT02 | Upload non-image attachment | `attachments/create-one.js` | P2 |
| FR-AT03 | Download attachment as authorised user | `GET /attachments/:id/download/:filename` | P1 |
| FR-AT04 | Non-authorised user gets 403 on download (IDOR) | route handler | P1 (security) |
| FR-AT05 | Set attachment as cover | `attachments/update-one.js` | P3 |
| FR-AT06 | Delete attachment | `attachments/delete-one.js` | P2 |
| **Notifications** | | | |
| FR-N01 | In-app notification appears on relevant action | socket `notificationCreate` | P1 |
| FR-N02 | Mark single / all notifications as read | `PATCH /api/notifications/:ids` | P2 |
| FR-N03 | Delete single / all notifications | `DELETE /api/notifications/:ids` | P3 |
| FR-N04 | Email batching: instant / batched / instant-then-batched | `cron-notifications-batching` | P2 |
| **Search & Filter** | | | |
| FR-S01 | Sidebar filter narrows projects + boards | sidebar `filterQuery` | P2 |
| FR-S02 | Card search by text on board | `CardSearch.query` | P2 |
| FR-S03 | Filter cards by member / label / due / notifications | `CardSearch.filterUsers` etc. | P2 |
| **Real-time** | | | |
| FR-RT01 | Tab B sees new card from Tab A within 2 s | socket `cardCreate` | P1 |
| FR-RT02 | Tab B sees moved card from Tab A | socket `cardUpdate` | P1 |
| FR-RT03 | Tab B sees deleted card from Tab A | socket `cardDelete` | P1 |
| FR-RT04 | Disconnected tab shows banner; reconnect refetches state | socket `disconnect`/`reconnect` | P2 |
| **Settings** | | | |
| FR-ST01 | Switch theme + shape + font, persists across reload | `UserPrefs` | P3 |
| FR-ST02 | Switch language, UI text changes, dates reformat | `UserPrefs.language` | P2 |
| FR-ST03 | Toggle notification subscriptions | `UserPrefs.subscribeTo*` | P3 |
| FR-ST04 | Update avatar | `users/update-avatar.js` | P2 |
| **Admin** | | | |
| FR-AD01 | Admin can list / create / delete users | `users/*` admin-only | P2 |
| FR-AD02 | Admin can toggle registration / SSO / allowed domains | `core/update.js` | P2 |
| FR-AD03 | Admin can create API client and reveal secret once | `api-clients/create.js` | P2 |
| FR-AD04 | Admin can create mail tokens for list/board | `mail-tokens/create.js` | P3 |

### 10.2 Non-functional requirements

| ID | Requirement | Target | Test |
|---|---|---|---|
| NFR-01 | Login page TTI | < 1 s p95 (M1-class) | Lighthouse CI |
| NFR-02 | Board page TTI with 50 cards | < 3 s p95 | Lighthouse CI + Playwright trace |
| NFR-03 | WebSocket cardUpdate propagation | < 500 ms p95 | Multi-tab Playwright spec with `performance.now()` |
| NFR-04 | A11y on canonical 5 pages | 0 serious/critical axe | `@axe-core/playwright` |
| NFR-05 | All endpoints over HTTPS in prod | TLS 1.2+ | Manual / ZAP |
| NFR-06 | i18n: zero missing keys for shipped languages | 0 | `pnpm client:ci:test` |
| NFR-07 | DB migration safe to roll forward and back | `pnpm server:db:migrate && pnpm server:db:rollback_one` round-trip | CI step |

### 10.3 Coverage of existing specs vs. requirements

| Existing spec | Maps to requirement(s) | Gap |
|---|---|---|
| `auth/auth.spec.ts` | FR-A01 (login), FR-A09 (logout) | FR-A02 (rate-limit), FR-A03 (register), FR-A04 (verify), FR-A05–A08 (account changes, OAuth) |
| `kanban.spec.ts` | FR-L01 (list CRUD), FR-C01 (card CRUD) | FR-C05 (duplicate), FR-C06–C09 (due/timer/cover/subscription); list collapse |
| `comments.spec.ts` | FR-CM01 (CRUD) | FR-CM02 (markdown), FR-CM03 (mentions) |
| `board-view.spec.ts` | FR-B05 (toggle), implicit FR-B05 session-scope (reload-resets) | List-view column visibility under data, sort, filter |
| `card-move.spec.ts` | FR-C02 (within list), FR-C03 (across lists), FR-C04 (across boards via popup) | DnD across boards (n/a — popup is the supported flow); position math under high reorder count (covered separately under R-06 server unit) |
| `list-reorder.spec.ts` | FR-L01 (reorder portion) | Reorder with collapsed lists; reorder while a list is hidden via filter; reorder propagation over WebSocket to a second tab |
| `task-reorder.spec.ts` | FR-T02 (task reorder) | Reorder propagation over WebSocket; reorder with completed-vs-incomplete grouping if applicable |

**Net coverage delta vs. previous plan revision**: +3 specs (card-move, list-reorder, task-reorder), +14 active tests, lifting FR-C02/C03/C04, FR-L01-reorder, and FR-T02 from "gap" to "covered". The largest remaining P1 gaps are RBAC, real-time multi-tab, attachments, and the auth lifecycle (registration / rate-limit / account changes).

### 10.4 Backlog of new specs (priority ordered)

Status legend: ✅ DONE · 🟡 PARTIAL · ⬜ TODO

P1 (release-blocking) — **build next**:

1. ⬜ `auth/registration.spec.ts` — register happy path, weak password rejected, duplicate email rejected, disallowed domain rejected when `Core.allowedRegisterDomains` set.
2. ⬜ `auth/rate-limit.spec.ts` — six failed logins → lockout response. *(Recommend implementing as server integration test instead — does not require browser; faster, less flake-prone. See R-11.)*
3. ⬜ `auth/account.spec.ts` — change password (with and without old-password), change username (length & regex boundaries), change email (verification flow).
4. ⬜ `rbac/board-roles.spec.ts` — viewer cannot add a card via UI **or** via direct API; viewer with `canComment` can comment; editor can do everything except delete board. *(Recommend the API negative half live in server integration; reserve E2E for the visible-button-hidden assertion only — see R-01.)*
5. ⬜ `rbac/cross-project-access.spec.ts` — log in as user A, request `/api/cards/<user-B-card-id>` and `/attachments/<user-B-attachment-id>/download/...` → 403. *(API-only; no browser needed. Move to server integration.)*
6. ✅ `board/card-move.spec.ts` — within list, across lists (single + multi-step), across boards via popup, persist-on-reload. **5 tests delivered.** *(Original ask included "via API"; that half belongs in server integration and is not duplicated at E2E.)*
7. ⬜ `board/card-duplicate.spec.ts` — duplicate carries tasks, labels, members, attachments.
8. ✅ `board/list-reorder.spec.ts` — drag list left ×1, right ×1, right ×2, persist-on-reload. **4 tests delivered.** *(Socket propagation deferred to spec #9.)*
9. ⬜ `realtime/two-tab-card-edit.spec.ts` — tab A renames, tab B sees rename; tab A moves, tab B sees move; both edit different fields → both survive. **Highest-leverage missing E2E** — only the browser layer can verify cross-tab WebSocket sync.
10. ⬜ `attachments/upload-and-download.spec.ts` — image (with thumbnail), pdf, IDOR negative case. *(IDOR negative belongs in server integration; the upload-UI half stays E2E.)*

P2 (release-important) — **build second**:

11. ⬜ `card-modal/description.spec.ts` — markdown render, edit/live/preview modes, links open with `rel=noopener`.
12. ⬜ `card-modal/due-date.spec.ts` — set, clear, overdue styling, time-zone correctness.
13. ⬜ `card-modal/labels.spec.ts` — create board label, assign to card, filter board by label.
14. 🟡 `card-modal/tasks.spec.ts` — task **reorder** delivered as `card-modal/task-reorder.spec.ts` (4 tests). Still TODO: add / complete / delete / complete-all toggle.
15. ⬜ `card-modal/members.spec.ts` — add member to card; member subscribed automatically.
16. ⬜ `notifications/in-app.spec.ts` — action triggers notification, badge increments, mark-read clears.
17. ⬜ `notifications/preferences.spec.ts` — toggle email mode, assert `UserPrefs.emailNotificationsDeliveryMode` round-trips.
18. ⬜ `search/board-card-search.spec.ts` — query text, case sensitivity, fuzzy toggle, member/label/due filters.
19. ⬜ `board/export-import.spec.ts` — export board, re-import via Trello-format and 4ga-format, content equivalence.
20. ⬜ `settings/profile.spec.ts` — avatar upload (image), failure on oversized.
21. ⬜ `settings/i18n.spec.ts` — switch to `de` and `ja`, assert key strings translate.
22. ⬜ `admin/users.spec.ts` — admin creates a user, the user can log in, admin deletes the user.
23. ⬜ `admin/api-clients.spec.ts` — create API client, reveal secret once, use it on `/api/projects` with `X-Client-Id`/`X-Client-Secret`.

P3 (nice-to-have):

24. ⬜ `card-modal/timer.spec.ts`, `card-modal/cover.spec.ts`, `card-modal/subscription.spec.ts`, `settings/theme.spec.ts`, `realtime/disconnect-banner.spec.ts`.

**Migration backlog (out of E2E, into Jest):**

25. ⬜ Component-level Jest specs that absorb the 11 deactivated guards from §3.6:
    - `LoginForm` — empty / username-only submit guards (replaces `auth.spec.ts` `Empty-submission guards`).
    - `AddListPopup`, `AddCardPopup` — empty / whitespace-only guards (replaces `kanban.spec.ts` `Empty-name guards`).
    - `CommentEdit` — empty / whitespace-only guards (replaces `comments.spec.ts` `Empty-text guards`).
    - `ConfirmDialog` (or `DeletePopup` consumer) — cancel-preserves-entity wiring (replaces all three `Cancel-confirmation guards` blocks).
    Once Jest equivalents land, the commented `/* … */` blocks can be deleted from the spec files (and the unreferenced POM helpers + `WHITESPACE_INPUT` / `EMPTY_CREDENTIALS` / `USERNAME_ONLY_CREDENTIALS` constants pruned).

## 11. Deliverables

| Artifact | Location | Status |
|---|---|---|
| This test plan | `docs/test-plan.md` | **Living document** — revised with current baseline, §3.6 layering policy, R-13/R-14 risks, completed-spec markers |
| Spec backlog (above) | `tests/tests/e2e/<area>/*.spec.ts` | 🟡 **Partial** — 3 of 10 P1 specs delivered (card-move, list-reorder, task-reorder partial of P2 #14); 11 deactivated tests pending Jest migration |
| Extended `ApiClient` | `tests/utils/api-client.ts` | 🟡 **Partial** — added `bootstrapBoardWithLayout`, `bootstrapTwoBoardLayout`, `bootstrapCardWithTasks`, `createList`, `createCard`, `createTask`, `purgeTestProjects`, `seedAuthCookies`. Still missing: comments, attachments, memberships, project managers, board memberships, labels, mail tokens, API clients |
| New POMs | `tests/pages/` | 🟡 **Partial** — `BoardPage` (with rbd DnD + cross-board move popup), `CardModalPage` (with rbd task DnD), `LoginPage`, `HeaderComponent`, `BasePage`. Still missing: `SidebarComponent`, `NotificationCenterPage`, `SettingsPage`, `FiltersPopupComponent`, `AdminPage` |
| Test-data additions | `tests/utils/test-data.ts`, `tests/fixtures/files/` | 🟡 **Partial** — `NamePrefixes` covers DnD layouts and second board; demo credentials wired. **Missing**: non-demo users (`viewer-bot`, `editor-bot`, `manager-bot`, `admin-bot`) and upload fixtures (`.png`, `.pdf`, oversized payload). Required for §10.4 specs #4, #5, #10, #20 |
| Global setup / teardown sweep | `tests/global-setup.ts`, `tests/global-teardown.ts` | ✅ **Done** — purges test-prefixed projects on session boundaries |
| Component-level Jest migration of deactivated guards | `client/src/components/<Component>/__tests__/` | ⬜ **TODO** — see §10.4 backlog item #25 |
| CI nightly job + trace artifact upload | `.github/workflows/e2e-nightly.yml` | ⬜ **TODO** |
| axe-core wired Playwright spec | `tests/tests/e2e/a11y/canonical-pages.spec.ts` | ⬜ **TODO** |
| Lighthouse CI config | `lighthouserc.json` | ⬜ **TODO** |
| Risk mitigation manual checklist | `docs/release-checklist.md` | ⬜ **TODO** |
| Release report template | `docs/test-report-template.md` | ⬜ **TODO** |

## 12. Roles and Responsibilities

| Role | Responsibility |
|---|---|
| **QA Lead** | Owns this plan; signs off release exit criteria; triages e2e flakes |
| **QA Engineer** | Authors specs in §10; maintains POMs and `ApiClient`; runs nightly results triage |
| **Backend Dev** | Owns server-side unit + integration tests; reviews API negative cases for RBAC/IDOR |
| **Frontend Dev** | Owns client unit tests (Jest); ensures locale keys exist before merging UI strings |
| **DevOps** | Provisions CI runners with Postgres + Node 24 + pnpm 10; manages test secrets; owns staging environment |
| **Product / Maintainer** | Reviews FR table for "did we miss intended behaviour"; owns the call when a behaviour is "by design" vs. "bug" |
| **Security Champion** | Owns ZAP baseline + IDOR sweep per release; signs off security exit criteria |
