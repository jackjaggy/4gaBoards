# Custom Skills — codifying standards as rubrics

## Why skills, not chat-pasted prompts

A 200-line prompt about "how we write Playwright tests in this repo" has three failure modes if you carry it in your head and re-paste it:
1. **You drift.** Each paste subtly differs; the agent's output drifts with it.
2. **It doesn't compose.** You can't easily mix it with another standard.
3. **It doesn't transfer.** A teammate can't reuse your standards without your chat history.

A **Claude Code skill** is a markdown file (with YAML frontmatter) that lives in `.claude/skills/<name>/SKILL.md`. The agent loads it on demand when you invoke it via `/skill-name` *or* when the description matches the task. Standards become a versioned, reviewable artifact instead of tribal knowledge.

## The two skills in this repo

Canonical copies live at `.claude/skills/`. They ship with the branch and any teammate who clones gets them automatically.

| Skill | Path | When it fires |
|---|---|---|
| `test-plan-generation` | [`.claude/skills/test-plan-generation/SKILL.md`](../../../.claude/skills/test-plan-generation/SKILL.md) | "create a test plan", "what should we cover for X", risk-based scoping |
| `playwright-e2e` | [`.claude/skills/playwright-e2e/SKILL.md`](../../../.claude/skills/playwright-e2e/SKILL.md) | "write/review/debug Playwright tests" — locators, POM, fixtures, anti-patterns |

## How I sourced them

Started from the community catalog:

```
npx @qaskills/cli add test-plan-generation
npx @qaskills/cli add playwright-e2e
```

That installs them under `~/.claude/skills/` (user-global). Two follow-up prompts moved them into the repo so they version with the code:

> *"Can we move this skill to this repo? Is it not possible?"*
>
> *"Want me to test which form Claude Code recognizes? Yes. Test it out."*

Net result: `.claude/skills/<name>/SKILL.md` works exactly the same as the user-global install, but ships with the branch.

## What I changed (and what I left alone)

The two skills are good general-purpose rubrics. I kept them **mostly unmodified** so a teammate reading them sees a standard, not my idiosyncrasies. The customizations live in **prompts** (phase library), not in the skills themselves. This is deliberate:

- **Skill** = "how we test Playwright in general."
- **Prompt** = "apply that skill to *this* spec, with these constraints, for *this* feature."

This separation made the skills reusable on a different project without edits.

## How I actually invoked them

The pattern that worked best is `/skill-name` + a one-line situational argument:

```
/playwright-e2e Review the end to end test cases (tests/e2e path) written so far.
                Suggest any changes if required according to the skill.

/playwright-e2e Apply these suggested changes:
                1. Fix waitForTimeout(60) in DnD — actual flake risk on CI.
                2. Replace [class*=...] CSS prefix selectors with getByRole/getByTestId.

/test-plan-generation Review the 4GABoards project. It contains development code as well.
                      Recently added some Playwright e2e tests. Requirements are not provided.
                      Instead read or understand the entire project from development code.
                      Generate a test plan for this.
```

Notice the shape:
1. The skill carries the standards (no need to repeat them).
2. The argument provides the *target* and *constraint*.
3. There's no "please" or apology — just the work.

## Skill-as-rubric audits — the highest-leverage pattern

The most useful move I found is to **invoke a skill against existing code as an audit**, not just at generation time:

> *"Are all the end to end tests in tests/e2e according to skill? Please review."*
>
> *"Review existing tests and make sure they follow the standards according to skill. Also refactor or move the test cases to right file name — make sure you just have files for each major feature. First plan it and let me know how you want to do."*

The agent then walks the skill rubric against the suite, calls out non-compliance, and (after my approval) refactors. This turned the skill from a write-time check into a continuous lint.

## What a custom skill of mine might look like next

If I were to add one for this repo specifically, it would be a `4gaboards-domain` skill capturing:
- The two-sided model graph (Waterline ↔ Redux-ORM) and the fields that must stay in sync.
- The websocket event names from `client/src/sagas/core/services/socket.js`.
- The `ApiClient.bootstrapBoard*` shortcuts and when to prefer them over UI flows.

That's a future investment, not part of this submission.
