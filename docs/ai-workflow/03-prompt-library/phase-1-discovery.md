# Phase 1 — Discovery

**Goal of this phase.** Bring the agent's mental model up to mine *before* asking it to produce anything. A wrong mental model produces fluent-but-wrong code; right mental model produces code I can ship.

**What "done" looks like.** `CLAUDE.md` exists, MCP works, skills are installed, the agent can answer "what does this app do?" without a grep tour.

---

## Prompts

### P1.1 — Bootstrap the project context file

```
/init
```

**Why this is a prompt at all.** `/init` is a single command, but it's the right *first* prompt because everything downstream depends on `CLAUDE.md` being good. I then spent ~20 minutes hand-editing the output (see [`../01-context-engineering/claude-md-approach.md`](../01-context-engineering/claude-md-approach.md) for what I kept vs. cut).

**What worked.** Treating the generated draft as a starting point, not the answer.

**What I'd refine.** Add a `## Testing` section to `CLAUDE.md` from day one — I added it later under pressure when the agent kept inventing test commands.

---

### P1.2 — Install standards as portable skills

```
npx @qaskills/cli add test-plan-generation
npx @qaskills/cli add playwright-e2e
```

Then:

> *"Can we move this skill to this repo? Is it not possible?"*

**Why this matters.** User-global skills (`~/.claude/skills/`) work but don't ship with the branch. Moving them to `.claude/skills/<name>/SKILL.md` makes the standards reviewable in PRs and reusable by teammates.

**What worked.** Asking explicitly *"test it out"* once the move was done — the agent verified Claude Code recognized the in-repo location before I trusted it.

---

### P1.3 — Probe the running app with MCP, not source-code archaeology

> *"Open `http://localhost:3000`, log in as `demo`/`demo`, open a card. Take a snapshot. I want to see what the card modal's accessible name is and whether the title has a `data-testid`. Don't change any code yet."*

**Why this prompt is shaped this way.**
- **Verb + target + constraint.** "Open … log in … take a snapshot." Each verb maps to an MCP tool call; the agent doesn't need to translate.
- **Read-only fence.** "Don't change any code yet." Reconnaissance should be cheap and reversible.

**What this unlocks.** Selector decisions become evidence-based. See [`../01-context-engineering/mcp-and-permissions.md`](../01-context-engineering/mcp-and-permissions.md) for the broader payoff.

---

### P1.4 — Have the agent narrate the architecture back to me

> *"Read `server/config/routes.js`, `server/api/models/`, and `client/src/models/`. Give me a one-paragraph summary of the entity graph and a list of the 3 most non-obvious things a new SDET should know about how state flows from a click in the UI to a row in the database."*

**Why I do this.** Three reasons:
1. It surfaces gaps in my own mental model cheaply.
2. The summary becomes raw material for `CLAUDE.md` updates.
3. It's a calibration check — if the agent's summary is wrong, I know I need to give it more context before trusting it on harder questions.

**What worked.** The "3 non-obvious things" constraint. Open-ended "summarize the architecture" prompts produce wall-of-text; constrained ones produce signal.

---

## Lessons from this phase

- **Read before write.** Every prompt in this phase is read-only. Resist the urge to start authoring tests until the agent can pass a 30-second oral exam on the repo.
- **Cheap discovery > thorough discovery.** I didn't try to comprehend the full 100+ component tree. I learned just enough to make Phase 2 (planning) productive.
- **The MCP browser is part of discovery.** A snapshot of the live DOM tells you things grep never will — like the fact that the rbd "Drag handle" announcement region is keyboard-driven, which set up the entire DnD strategy in Phase 4.
