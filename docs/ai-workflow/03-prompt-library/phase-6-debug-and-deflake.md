# Phase 6 — Debug & Deflake

**Goal of this phase.** Hunt flakes to root cause, not to a "works on my machine" patch. A flaky test that's been "fixed" once but still fails 1-in-20 is a worse defect than the bug it's meant to catch — it teaches the team to ignore failures.

**Conviction going in.** Most flakes in Playwright are wait-strategy bugs. Most "fix" attempts make the wait *bigger* and call it done. The right fix is to wait on the **specific event** that signals "the thing I'm asserting has happened" — usually an API response, a WebSocket frame, or a stable DOM mutation.

---

## Prompts

### P6.1 — Frame the flake honestly

```
/playwright-e2e  1 failed
   [chromium] › tests/tests/e2e/card-modal/task-reorder.spec.ts:34:7
   › Task reorder inside a card (drag and drop)
   › task reorder persists across a full page reload

Sometimes failing, sometimes passing. A flaky test. Make sure you fix it
according to skill and use Playwright MCP for refactoring.
```

**Why this prompt is shaped this way.**
- **Paste the actual failure header.** Spec name, line number, scenario title — the agent doesn't have to guess what test you mean.
- **"Sometimes failing, sometimes passing."** Explicitly signals "this is non-deterministic, not a deterministic break." Sets the agent's debug strategy correctly.
- **"According to skill."** Tells the agent to apply the wait-strategy rubric, not to slap a `waitForTimeout`.
- **"Use Playwright MCP."** Forces evidence-based debugging — open the modal, observe the actual sequence of events.

---

### P6.2 — Probe the underlying event

> *"Task reorder runs through `sails-hook-sockets` (Socket.IO), not an HTTP PATCH. Read `client/src/sagas/core/services/socket.js` and `server/api/helpers/tasks/update-one.js`. Walk me through the exact sequence of events from `Space → Down → Space` on the task list to the row being persisted in Postgres. I want to know which event we should wait on before reloading."*

**Why this prompt matters.** Flakes hide in **which event signals "the thing I'm asserting has actually happened."** This prompt forces the agent to trace the real path — saga → socket emit → server handler → DB write → broadcast ack — instead of guessing.

**What came back.** The position update is emitted over the websocket as a `taskUpdate` event, ack'd by the server. The previous test was waiting on a generic `networkidle` *or* a short `waitForTimeout` — both wrong. The fix was a listener on the websocket frame that observes the ack before the reload.

---

### P6.3 — Capture the websocket from the right place

> *"Update `CardModalPage` so that the websocket listener is registered in the constructor, *before* the SPA boots and opens its Socket.IO connection. Fixture order is: `cardModal: new CardModalPage(page)` runs before `boardWithThreeTasks: boardPage.goto(...)`, so a constructor-time listener will see the very first websocket. Reloads replace the websocket; keep the latest. Add a comment explaining this — it'll save the next person a day."*

**Why this prompt is shaped this way.**
- **The fixture ordering is the load-bearing detail.** Without it, the listener could miss the first connection.
- **"Reloads replace the websocket; keep the latest."** Names the gotcha so the implementation handles it.
- **"Add a comment."** The non-obvious mechanics are exactly the kind that get unwound by a future "simplification." A `// Why` comment is the cheapest insurance.

**The comment that landed** (in `tests/pages/card-modal.page.ts`):

```ts
// Listener registered eagerly in the constructor. Fixture order is:
//   cardModal: new CardModalPage(page)  →  boardWithThreeTasks: boardPage.goto(...)
// i.e. this listener is in place before the SPA boots and opens its Socket.IO
// connection, so we capture the very first websocket. Subsequent reloads
// replace it; we always keep the latest one.
```

This is the *only* comment block I let the agent leave behind — everywhere else, code is self-documenting. Here the *why* is genuinely non-obvious.

---

### P6.4 — Verify the fix with a deflake run

```
E2E_API_BASE_URL=http://localhost:1337 pnpm exec playwright test \
  --project=chromium \
  tests/tests/e2e/card-modal/task-reorder.spec.ts \
  -g "persists across a full page reload" \
  --repeat-each=15 \
  --reporter=list
```

**Why 15.** A single pass is meaningless for an intermittent flake. 15 runs is enough that a 1-in-3 flake is virtually certain to repro, and a clean run gives genuine confidence.

**What came back.** 15/15 green. Documented in [`../04-case-studies/cs-04-flake-investigation.md`](../04-case-studies/cs-04-flake-investigation.md).

---

### P6.5 — Tooling drift catches

> *"There are problems-2 showing up in `tsconfig.json` file. Able to run test cases fine and also test cases passing. So what is the issue about `tsconfig.json` file and suggest any plan to fix it?"*

**Why this prompt matters.** Not all "debug" prompts are about flaky tests — sometimes the IDE shows red squiggles that don't affect runtime but will bite the next person. This prompt explicitly separates "passing" from "clean", and asks for a *plan* before changes, because tsconfig edits in a monorepo can cascade.

---

## Lessons from this phase

- **Flake fix = wait-strategy fix.** Almost always. If the proposed fix is "wait longer", reject it.
- **Trace the event chain.** Read the saga, read the helper, draw the line from action to persisted state. Then wait on the specific event that signals persistence.
- **`--repeat-each=15` is the certification step.** A "fix" without a deflake run hasn't proven anything.
- **Leave a `// why` comment for non-obvious timing tricks.** Only there. Nowhere else.
- **Separate "tests pass" from "code is clean."** They're independent quality signals.
