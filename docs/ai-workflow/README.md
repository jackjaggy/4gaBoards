# AI-Assisted E2E Automation — Workflow Submission

**Author.** Jagadeesh Marella

**Project under test.** [4ga Boards](../../README.md) — a Trello-style PM app (React 18 SPA + Sails.js + Postgres, mirrored Redux-ORM/Waterline domain).

**Deliverable.** A working Playwright E2E suite (TypeScript, POM, custom fixtures, API-driven bootstrap, MCP-assisted DOM exploration) plus a risk-based [test plan](../test-plan.md). 30 active specs across auth, board CRUD, drag-and-drop, card-modal flows.

This document is the *meta-deliverable*: how I used AI to get there, with verbatim prompts and an honest account of what worked.

---

## 1. The thesis

> An AI agent is leverage, not a labor replacement. The job is to make the agent's context match a senior engineer's mental model — repo conventions, what "good E2E" means here, what *not* to do — and then drive it with prompts that are specific about the *artifact*, the *constraint*, and the *rubric*.

Concretely, that translated into three layers that the rest of this package documents:

| Layer | Purpose | Lives in |
|---|---|---|
| **Persistent context** | `CLAUDE.md` (project conventions), `.mcp.json` (Playwright MCP server for live DOM inspection), `.claude/settings.local.json` (permission allowlist for the long tail of safe commands) | repo root + `.claude/` |
| **Reusable skills** | Two custom Claude skills — `test-plan-generation` and `playwright-e2e` — that encode my standards as a rubric the agent applies on every invocation | `.claude/skills/` |
| **Phase-specific prompts** | A library of prompts mapped to seven phases of the test-automation lifecycle, with annotations on *what worked* and *what I'd refine* | `docs/ai-workflow/03-prompt-library/` |

## 2. How to read this package

- **Tight on time?** Read this file + [`05-anti-patterns.md`](./05-anti-patterns.md). They show what I asked the agent to do AND not to do.
- **Want the playbook?** Walk [`03-prompt-library/`](./03-prompt-library/) phase by phase — each phase has 3-6 verbatim prompts annotated with rationale.
- **Want proof of depth?** Skim [`04-case-studies/`](./04-case-studies/) — the four non-trivial problems where prompting technique was the difference between a 30-minute fix and a 3-day rathole.

## 3. The seven phases

```
1. Discovery     → /init + codebase walk + MCP DOM probe
2. Planning      → /test-plan-generation → risk-based plan
3. Selection     → "good E2E candidate?" rubric, happy + negative
4. Authoring     → POM + fixtures + ApiClient bootstrap
5. Review        → /playwright-e2e as a skill-rubric audit
6. Debug         → flake hunts, websocket waits, deflake runs
7. Ship          → teardown, PR prep
```

Each phase has a dedicated file in `03-prompt-library/`. The verbatim prompts are lightly cleaned (typos and obvious grammar fixes only) — they reflect how I actually worked, not how I wish I had worked.

## 4. What this submission shows

| Senior-SDET signal | Where to look |
|---|---|
| Tooling beyond chat — MCP, skills, permissions, hooks | [`01-context-engineering/`](./01-context-engineering/) |
| Standards codified, not memorized | [`02-skills/`](./02-skills/) + `.claude/skills/` |
| Risk-based scope, layer-appropriate testing | [`03-prompt-library/phase-3-scenario-selection.md`](./03-prompt-library/phase-3-scenario-selection.md) and [`test-plan.md`](../test-plan.md) |
| Knowing when to NOT automate (8 input-guard tests pruned to Jest) | [`04-case-studies/cs-03-deactivate-vs-delete.md`](./04-case-studies/cs-03-deactivate-vs-delete.md) |
| Hard-mode E2E (DnD over WebSocket, multi-tab, deflake) | [`04-case-studies/cs-01-drag-and-drop-websocket.md`](./04-case-studies/cs-01-drag-and-drop-websocket.md), [`cs-04-flake-investigation.md`](./04-case-studies/cs-04-flake-investigation.md) |
| Fast inner loop via API bootstrap, not UI clicks | [`04-case-studies/cs-02-api-driven-bootstrap.md`](./04-case-studies/cs-02-api-driven-bootstrap.md) |
| Test-data hygiene + pre-merge discipline | [`03-prompt-library/phase-7-hygiene-and-ship.md`](./03-prompt-library/phase-7-hygiene-and-ship.md) |
| Critical self-check of the agent ("did you use MCP?", "did you delete unused files?") | [`05-anti-patterns.md`](./05-anti-patterns.md) |

## 5. Honest limits

- **Local stack only.** OAuth/SSO flows and email delivery are out of scope per the test plan §2.2 — they need sandbox tenants the agent can't conjure.
- **Chromium-only**, `workers: 1`, `fullyParallel: false`. Reflects the app's heavy DnD/websocket coupling, not a Playwright limitation.
- **The agent gets things wrong.** A non-trivial slice of the prompt library is *me catching the agent* — wrong selector strategy, missed teardown, undeleted scratch files. The corrections themselves are part of the deliverable.
