# Case Study 04 — Flake Investigation & Certification

**The flake.** `tests/e2e/card-modal/task-reorder.spec.ts:34` — "task reorder persists across a full page reload" — failed roughly 1-in-5 on local headless runs.

**Why this case study exists.** The investigation and the certification are two different skills. Most engineers do the first OK; few do the second at all.

---

## The investigation (root cause, not "wait longer")

Detailed in [`cs-01-drag-and-drop-websocket.md`](./cs-01-drag-and-drop-websocket.md). Short version:

1. Drag emits a Socket.IO `taskUpdate` frame.
2. Server ack arrives ~milliseconds later.
3. Test reloaded the page *before* the ack landed about 1-in-5 times.
4. The fix is a websocket listener registered in the POM constructor (before the SPA opens its connection), awaiting the specific ack before reload.

Three wrong proposals from the agent first:
- `waitForTimeout(500)` — rejected.
- `waitForLoadState('networkidle')` — improved but defeated by Socket.IO heartbeats.
- Generic `waitForResponse(/tasks/)` — wrong protocol; the update is over WS, not HTTP.

The fourth attempt (constructor-time WS listener + ack wait) landed.

---

## The certification (the part most teams skip)

A green run after a flake fix proves nothing. You need a **statistically meaningful repeat** to claim the fix worked.

### The command

```bash
E2E_API_BASE_URL=http://localhost:1337 pnpm exec playwright test \
  --project=chromium \
  tests/e2e/card-modal/task-reorder.spec.ts \
  -g "persists across a full page reload" \
  --repeat-each=15 \
  --reporter=list
```

### Why 15

For a flake that occurred roughly 1-in-5 (~20% per run), 15 independent runs gives:
- Probability of zero failures *under the original flake rate*: `0.8^15 ≈ 3.5%`.
- A clean 15/15 is therefore **strong evidence** the fix moved the dial, not luck.

For lower-rate flakes (1-in-20), bump to `--repeat-each=50`. For one-in-a-hundred flakes, you're better off accepting that local certification is a poor instrument and gating on CI history instead.

### The result

```
Running 1 test using 1 worker
  ✓  1 [chromium] › task-reorder.spec.ts:34:7 › task reorder persists across a full page reload (2.0s)
  ... [repeated 14 more times]
  15 passed
```

15/15 green. Filed under "fixed", not "probably fixed."

---

## What this case study demonstrates

| Skill | Evidence |
|---|---|
| Treating "wait longer" as a smell, not a solution | Three rejected proposals |
| Protocol awareness (HTTP vs. WebSocket) | Fix matched the actual event channel |
| Statistical thinking about flake rates | `--repeat-each=15` justified by 1-in-5 base rate |
| Certifying a fix, not just landing it | The deflake run is the proof |
| Knowing when local certification stops working | Note about 1-in-100 flakes needing CI history |

---

## A reusable deflake-prompt template

For future flakes, the prompt skeleton that works:

```
/playwright-e2e
   <paste the failure header verbatim>

Sometimes failing, sometimes passing — flake, not a deterministic break.

Investigate root cause by tracing the event chain from interaction to
persistence. Probe the live behavior with Playwright MCP. DO NOT propose
a time-based wait — find the specific event (HTTP response, WS frame,
DOM mutation) that signals "the thing I'm asserting has happened."

After the fix, run with --repeat-each=<N> where N is at least 1/p (p =
observed failure rate). Report N/N pass before claiming done.
```

That template has fixed three flakes in this suite so far, with no regressions.
