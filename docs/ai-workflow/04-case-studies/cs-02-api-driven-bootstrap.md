# Case Study 02 — API-Driven Bootstrap

**Files of interest.**
- [`tests/utils/api-client.ts`](../../../tests/utils/api-client.ts) — typed REST client for the Sails API.
- [`tests/fixtures/test.fixture.ts`](../../../tests/fixtures/test.fixture.ts) — fixtures composed on top of it.
- [`tests/global-setup.ts`](../../../tests/global-setup.ts) / [`global-teardown.ts`](../../../tests/global-teardown.ts) — token bootstrap + cascade cleanup.

---

## The problem

A board-level test ("rename a card and assert it persists across reload") needs preconditions:
- A logged-in session.
- A project (or use the seeded one).
- A board with at least one list and one card.

Doing all that **through the UI** before every test takes ~6 seconds and exercises ~12 features irrelevant to the actual assertion. The cost compounds:
- Slower suite → people stop running it locally → suite goes stale.
- Setup steps fail intermittently → flake noise that has nothing to do with the feature under test.
- The setup *is* the test — when something breaks early, you don't know which feature is at fault.

The senior answer is **API-driven bootstrap**: skip the UI for setup, use REST. Reserve the UI for the *interaction under test*.

---

## The prompt arc

### Frame the design, name the API

> *"Build an `ApiClient` in `tests/utils/api-client.ts` that uses the Sails REST surface (`/api/access-tokens`, `/api/projects`, `/api/projects/:id/boards`, `/api/boards/:id/lists`, `/api/lists/:id/cards`, etc.). Methods I want: `login()`, `createBoard()`, `createList()`, `createCard()`, `createTask()`, `addComment()`, plus `cascadeDeleteBoard()` that handles dependent rows. Hold the access token internally; expose it via a getter for socket auth. Typed TypeScript. No mocking — this hits the real local server."*

**Why this prompt is shaped this way.**
- **Lists the exact endpoints.** Saves the round of "where do I find the routes?"
- **Lists the methods I want.** Names the shape; the agent doesn't invent a `bootstrapEverything()` god-method.
- **`cascadeDelete*`** is called out explicitly because Sails Waterline doesn't cascade by default — the agent needs to delete children first.
- **"No mocking."** This is integration glue; mocking it defeats the purpose.

### Compose fixtures on top

> *"Now build Playwright fixtures in `tests/fixtures/test.fixture.ts` that use `ApiClient` to bootstrap:
> - `boardWithCard` — one board, one list, one card.
> - `boardWithThreeTasks` — one board, one list, one card with three tasks (for DnD).
> - `boardWithCardAndComment` — adds one comment to the card.
> - `twoBoards` — for cross-board move tests.
>
> Each fixture must clean up its own resources in the `use` lifecycle (after the test), via `ApiClient.cascadeDelete*`. Cleanup must run even if the test fails. No fixture leaks into another."*

**Why this works.**
- **Names every fixture.** Less is more — these four cover the whole suite. Avoids `boardWithXAndYAndZ` proliferation.
- **Cleanup is a contract, not a hope.** "Must run even if the test fails" — pins the implementation to `await use(...); cleanup();`.
- **"No fixture leaks into another."** Sets the isolation expectation.

### The teardown audit

After a few specs landed, this prompt:

> *"Tests are generating data every time I run tests. When I log in to `http://localhost:3000/` I could find lots of data. Isn't the best practice to clean up test data after each run or test case completion?"*

(Full prompt at [`../03-prompt-library/phase-7-hygiene-and-ship.md`](../03-prompt-library/phase-7-hygiene-and-ship.md) §P7.1.)

The audit caught a few fixtures where teardown was skipped or partial. After the fix, the dev board surfaced clean after each suite run — a small thing that *massively* changes whether teammates will actually run E2E locally.

---

## What changed in practice

| Metric | Before API bootstrap | After |
|---|---:|---:|
| Avg per-test setup time | ~6 s (UI) | ~250 ms (REST) |
| Setup-induced flake rate | ~5% | ~0% (cleanup ack'd by API) |
| Specs that need a fresh board | Each spec rolls its own | One fixture, used by all |

The fastest tests are the ones where setup didn't happen in the browser.

---

## What this case study demonstrates

| Skill | Evidence |
|---|---|
| Knowing when UI is a tool vs. a test target | Use REST for setup; UI only for the interaction under test |
| Designing for cleanup at fixture creation time | Cascade delete contract baked in |
| Typed integration glue | TypeScript `ApiClient`, not raw fetch in every spec |
| Refusing to mock when integration is the point | Real local stack, real tokens, real teardown |
| Catching agent drift via re-audits | "New tests skipped teardown" caught in P7.2 |
