# Context engineering — `CLAUDE.md`

## Why this file exists

An AI agent loaded into a 100k-LOC monorepo will hallucinate conventions if it has nothing to anchor on. `CLAUDE.md` (auto-loaded into every Claude Code session) is the cheapest, highest-leverage piece of context engineering available. I treat it as an **onboarding doc for a fast but forgetful new hire** — what they need before their first PR, and nothing more.

## What I deliberately included

- **Workspace shape.** pnpm monorepo, three runtime artifacts (`client`, `server`, `packages`), and what each is. Stops the agent from grep-ing the whole tree to figure out where to look.
- **The exact `pnpm` commands** I use for dev, lint, unit test, and E2E — verbatim from how I actually run them, so the agent doesn't invent `npm run e2e` or `yarn test:e2e`.
- **E2E specifics that surprise.** That `test:e2e` does *not* start the stack itself; that helpers assume `demo`/`demo`; that the MCP Playwright server in `.mcp.json` is available.
- **Domain model location, both sides.** `server/api/models/` and `client/src/models/` — same entity graph, two ORMs. The agent needs this to suggest changes that don't drift the two sides.
- **The saga pipeline shape** — `entry-actions → watchers → services → requests → API`. Without this the agent will plug into the wrong layer when asked to extend a flow.
- **Conventional Commits + Airbnb-Prettier + import sort order.** Saves an entire round of style nits per PR.

## What I deliberately left out

- **No tutorial.** I don't explain what Sails or Redux-ORM are. The agent knows. Padding the file dilutes the load-bearing parts.
- **No history.** "We used to use yarn but migrated to pnpm" is noise. Just state the current rule.
- **No architecture aspirations.** Document what *is*, not what we wish were true.

## The bootstrap prompt I used

```
/init
```

That single slash command generates a first-draft `CLAUDE.md` from the repo. I then hand-edited it for ~20 minutes to:
1. Remove generic boilerplate.
2. Add the E2E section (the most non-obvious part of this repo).
3. Add the "Only one lockfile" rule — pnpm enforcement is genuinely surprising.

## The maintenance discipline

When the agent **misunderstands the repo twice in a row in a way `CLAUDE.md` could prevent**, the fix is to update `CLAUDE.md`, not to keep re-explaining in chat. Two examples from this project:

| Symptom | Fix in `CLAUDE.md` |
|---|---|
| Agent kept suggesting `npm install` | Added `Node ^24.11, pnpm ^10.33` and "All commands use **pnpm** (enforced by `devEngines`)" |
| Agent started UI flows when API bootstrap was faster | Added the saga pipeline diagram so it could see the layer boundary |

## Anti-pattern I avoided

Stuffing `CLAUDE.md` with *negative* rules — *"don't do X, don't do Y, don't ever Z"*. Those belong in skills (rubrics that fire on a specific task), not in always-loaded context. The signal-to-noise ratio matters because `CLAUDE.md` is in the prompt for every single message.
