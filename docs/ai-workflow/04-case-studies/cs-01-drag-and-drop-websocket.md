# Case Study 01 — Drag & Drop over WebSocket

**Spec.** [`tests/e2e/card-modal/task-reorder.spec.ts`](../../../tests/e2e/card-modal/task-reorder.spec.ts)
**POM.** [`tests/pages/card-modal.page.ts`](../../../tests/pages/card-modal.page.ts)
**Status.** 4/4 scenarios stable, certified via `--repeat-each=15`.

---

## Why this is hard

Task reorder in a card modal looks trivial in the UI — drag a row, see it persist after reload. But:

1. **The drag library is `react-beautiful-dnd`.** Mouse drag in Playwright is unreliable against rbd; the keyboard sensor (`Space → arrows → Space`) is the deterministic path.
2. **The position update flows over Socket.IO**, not HTTP. `sails-hook-sockets` ack frames are how you know the server accepted the update — a standard `waitForResponse` against `/api/tasks/*` won't fire.
3. **The websocket connection opens during SPA boot.** If you register a listener in `test.beforeEach`, you've already missed it.
4. **Page reloads recreate the websocket.** Whatever listener captured the first connection is now stale.

A naive test ("drag, reload, assert order") will pass 80% of the time and fail the other 20% — the worst kind of flake.

---

## The prompt arc

### Frame the symptom honestly

```
/playwright-e2e  1 failed
   [chromium] › task-reorder.spec.ts:34:7
   › task reorder persists across a full page reload
Sometimes failing, sometimes passing. A flaky test. Make sure you fix it
according to skill and use Playwright MCP for refactoring.
```

**Why this works.** "Sometimes failing, sometimes passing" tells the agent this is non-determinism, not a deterministic break. That single phrase changes the debug strategy.

### Drive a real root-cause investigation

> *"Task reorder in the card modal flows over `sails-hook-sockets` (Socket.IO), not HTTP. Our standard `waitForResponse` won't see the position update. Read `client/src/sagas/core/services/socket.js` and `server/api/helpers/tasks/`, then propose a wait strategy that listens to the websocket ack frame from the constructor of `CardModalPage` so the listener is in place before the SPA opens the connection. Show me the POM diff first; don't edit until I confirm."*

**Why this prompt is the senior move.**
- **Names the protocol.** Socket.IO, not HTTP. The agent doesn't have to guess.
- **Points to the source of truth.** The saga services file and the server helper.
- **Specifies the listener placement** (constructor, not method) and **the reason** (fixture ordering).
- **Diff-first checkpoint.** "Show me the POM diff before editing." Cheap insurance against a wrong refactor.

### Force the comment that prevents future regression

> *"Add a comment to the constructor explaining the listener placement. The non-obvious mechanics will get unwound by a future 'simplification' otherwise. Comment is the cheapest insurance."*

The result, verbatim, in `card-modal.page.ts`:

```ts
// Listener registered eagerly in the constructor. Fixture order is:
//   cardModal: new CardModalPage(page)  →  boardWithThreeTasks: boardPage.goto(...)
// i.e. this listener is in place before the SPA boots and opens its Socket.IO
// connection, so we capture the very first websocket. Subsequent reloads
// replace it; we always keep the latest one.
```

This is the **only block comment** I let stand in the suite. Everywhere else, names carry the meaning. Here, the *why* is genuinely non-obvious and the cost of losing it is high.

### Certify with `--repeat-each=15`

```bash
E2E_API_BASE_URL=http://localhost:1337 pnpm exec playwright test \
  --project=chromium \
  tests/e2e/card-modal/task-reorder.spec.ts \
  -g "persists across a full page reload" \
  --repeat-each=15 \
  --reporter=list
```

Result: 15/15 green. The fix is real, not lucky.

---

## What the agent got wrong on the first try

1. **First attempt:** added `waitForTimeout(500)` after the drag. Rejected.
2. **Second attempt:** waited on `networkidle` after the drag. Improved but not deterministic — Socket.IO heartbeat traffic keeps the network busy intermittently.
3. **Third attempt** (after the constructor-listener prompt): captured the websocket eagerly, awaited the specific ack frame. Stable.

Each rejection cost ~30 seconds of agent time. The total time to root cause was ~15 minutes — which would have been a half-day without the prompting structure above.

---

## What this case study demonstrates

| Skill | Evidence |
|---|---|
| Reading framework internals to find the right event | Pointed agent at `sails-hook-sockets` + saga services |
| Diff-first prompting for risky refactors | "Show me the POM diff before editing" |
| Writing the *why* comment when (and only when) it pays for itself | The constructor block comment |
| Certifying a fix, not just landing it | `--repeat-each=15` deflake run |
| Rejecting "wait longer" as a fix | First two attempts both proposed time-based waits |
