# Phase 4 — Authoring

**Goal of this phase.** Turn approved scenarios into working Playwright specs that follow the `playwright-e2e` skill: POM, custom fixtures, API-driven bootstrap, resilient selectors, deterministic waits.

**Conviction going in.** The 80/20 of an authoring prompt is the *scaffolding constraints*, not the test case. "Write a test for X" produces something that works once; "Write a test for X using fixture Y, POM Z, with API bootstrap and no `waitForTimeout`" produces something that lasts.

---

## Prompts

### P4.1 — Restructure the existing scratch tests to the skill's standard layout

```
/playwright-e2e I already have working tests at location `tests/tests` which
                are passing. Follow this skill and restructure the tests if
                required accordingly and make sure tests are in working/passing
                state.
```

**Why this is the right first authoring prompt.** Before adding new tests, normalize what exists. The skill's layout (`tests/e2e/<feature>/`, kebab-case POMs, custom fixtures, utils split) gives every later prompt a stable target.

**What worked.** The agent moved tests into the canonical layout, extracted POMs, added `test.fixture.ts`, and re-ran the suite — all on one prompt. The skill carried 95% of the decisions.

**What I corrected after.** Some pages had been auto-generated POMs with too many helpers. I deleted the unused ones in a follow-up prompt (the agent is biased toward "complete" page objects; I want "the helpers we actually call").

---

### P4.2 — Add custom fixtures for shared preconditions

> *"Add custom Playwright fixtures that bootstrap board state via the API, not via UI clicks. We need at minimum: `boardWithCard` (single card), `boardWithThreeTasks` (a card with three tasks), `twoBoards` (cross-board move test). Use the existing `ApiClient` in `utils/api-client.ts`. Each fixture must clean up its own resources after the test via the `use` lifecycle. No UI-driven setup."*

**Why this prompt is shaped this way.**
- **Names the exact fixtures.** Saves the agent from guessing the right granularity.
- **"No UI-driven setup."** A direct constraint — without it the agent will sometimes default to "click Add Card, type, click confirm" because that's what's in the existing tests.
- **"Each fixture must clean up its own resources."** Forces the teardown pattern from the start, not as a Phase 7 retrofit.

**Resulting fixture file.** `tests/fixtures/test.fixture.ts` — exposes `apiClient`, `boardWithCard`, `boardWithThreeTasks`, `boardWithCardAndComment`, `twoBoards`, plus the POM fixtures. See [`../04-case-studies/cs-02-api-driven-bootstrap.md`](../04-case-studies/cs-02-api-driven-bootstrap.md) for the deeper rationale.

---

### P4.3 — Author a spec with the constraint stack made explicit

> *"Write a spec at `tests/tests/e2e/board/card-move.spec.ts` covering: (a) within-list reorder via drag-and-drop, (b) cross-list move via drag-and-drop in one step, (c) cross-list move in two steps, (d) persistence after a full page reload, (e) cross-board move via the card move popup. Use the `boardWithCard` fixture for (a)-(d) and `twoBoards` for (e). For DnD use `react-beautiful-dnd`'s keyboard sensor (Space → arrows → Space) — do NOT use mouse drag, it's flaky here. Locators: `getByRole`/`getByTestId`. No `waitForTimeout`. Wait on the relevant API response or socket ack, not on time."*

**Why this prompt is shaped this way.**
- **Numbered scenarios.** The agent groups assertions correctly when scenarios are numbered.
- **Fixture binding per scenario.** Removes ambiguity about preconditions.
- **DnD strategy hard-coded.** "Keyboard sensor, not mouse drag" is the difference between a stable suite and a flake farm.
- **Explicit anti-patterns.** "No `waitForTimeout`." The skill says this; restating it inline raises the chance the agent follows it.
- **Wait strategy specified.** "API response or socket ack, not time." Tells the agent how to translate the rubric into actual `await` calls.

---

### P4.4 — Use MCP to settle selector ambiguity *during* authoring

> *"Before writing the spec, open the card modal with MCP and snapshot the accessibility tree. I want to see the card title node's role, accessible name, and whether it has a `data-testid`. If there's no `data-testid` on the title, add one to the React component (`client/src/components/CardModal/...`) using a stable name like `card-modal-title`, then use it in the POM."*

**Why this prompt matters.** It bakes the right *order of operations* into the agent's behavior:
1. Probe the live DOM.
2. Decide on the selector based on evidence.
3. If the right selector doesn't exist, add it to the application, not to the test.

This produced the `data-testid="card-modal-title"` addition in `CardModal.jsx` — visible in the project's git status — and replaced an earlier XPath that had snuck in.

---

### P4.5 — Loop: run, read failure, fix, re-run

> *"Run `pnpm test:e2e --project=chromium -g 'card-move'` and report. If anything fails, debug and fix — but tell me what you changed before I approve."*

**Why this prompt is shaped this way.**
- **Narrow grep.** `-g 'card-move'` keeps the loop fast.
- **"Tell me what you changed before I approve."** The agent can re-run; it should not silently rewrite production code (e.g. add `data-testid`s) without telling me.

This is the inner loop pattern: **agent runs the suite, reads the failure, proposes a fix, asks for approval, applies it, re-runs.** When that loop is tight, authoring goes from hours to minutes per spec.

---

## Constraints I encode in *every* authoring prompt

A senior-prompt checklist:

| Constraint | Why |
|---|---|
| **POM location explicit** | `tests/pages/<feature>.page.ts` — keeps the agent from sprinkling selectors into specs |
| **Fixture name explicit** | Cuts the "is there already a fixture for this?" round-trip |
| **Selector strategy** | `getByRole` / `getByTestId`, no XPath, no `[class*=...]` |
| **Wait strategy** | API response, socket ack, or `expect(...).toHaveText(...)` — no `waitForTimeout` |
| **Cleanup expectation** | "Fixture cleans up after itself" — forced from day one |
| **Test name shape** | Imperative, journey-oriented (`'rename card via card-modal title'`), not implementation-detail (`'test_renameCard_happy'`) |

The skill captures all of these. Restating them inline is belt-and-suspenders; for non-trivial specs it's worth the few extra tokens.

## Lessons from this phase

- **Authoring prompts should over-specify.** "Write a test for X" is a junior prompt. "Write a test for X using fixture Y, POM Z, wait strategy W, no anti-patterns from the skill" is the senior version.
- **Probe the DOM during authoring, not after.** MCP-first turns selector choice into evidence, not guesswork.
- **Run the spec immediately.** The cheapest debug round is the one where the agent's context is still fresh.
