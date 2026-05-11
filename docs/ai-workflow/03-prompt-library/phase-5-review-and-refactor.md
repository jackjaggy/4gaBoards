# Phase 5 — Review & Refactor

**Goal of this phase.** Treat the skill as a **lint rubric** and run it across the suite repeatedly. Tests are code; code rots; rubrics catch the rot.

**The pattern in one sentence.** Invoke the skill as a reviewer (`/playwright-e2e <audit prompt>`), get a numbered finding list, then **selectively** apply (not the whole list — review the review).

---

## Prompts

### P5.1 — Skill-as-rubric audit

```
/playwright-e2e Review the end to end test cases (`tests/e2e` path) written so
                far. Suggest any changes if required according to the skill.
```

**Why this prompt is shaped this way.**
- **Skill + scope + verb.** Minimal text; the skill carries the rubric.
- **"Suggest"**, not "apply". Audit output is a list, not a refactor. Application happens on a *separate* prompt after I review the list.

**Representative findings.** The agent flagged:
1. `waitForTimeout(60)` in a DnD test — real flake risk on CI.
2. `[class*=...]` CSS prefix selectors in two POMs — fragile to CSS-Module hash changes.
3. A POM with a constructor that did `await` (legal in JS, smelly here).
4. Tests that asserted side effects via re-locating instead of using `expect(locator).toHaveText(...)`.

---

### P5.2 — Selective apply

```
/playwright-e2e Apply these suggested changes:
                1. Fix waitForTimeout(60) in DnD — actual flake risk on CI.
                2. Replace [class*=...] CSS prefix selectors with getByRole or
                   getByTestId. Use Playwright MCP to confirm the role/testid
                   exists before each replacement.
                3. Skip the constructor await — pull that into a fixture.
                Run the full suite after each fix and report before moving on.
```

**Why this prompt is shaped this way.**
- **Subset of the audit list.** I rejected one finding (the toHaveText one was already correct; the agent had misread it). Don't accept the agent's review wholesale.
- **MCP confirmation step.** Before swapping a selector, prove the replacement exists.
- **"Run after each fix and report."** Catches refactors that compile but break behavior.

---

### P5.3 — Plan-first refactor for larger restructures

```
/playwright-e2e Review existing tests and make sure they follow the standards
                according to skill. Also refactor or move the test cases to
                right file name — make sure you just have files for each major
                feature. First plan it and let me know how you want to do.
```

Reply: *"Yes proceed, I like your plan."*

**Why this prompt is shaped this way.**
- **"First plan it."** Refactors that touch file moves + renames + import paths are the kind where the agent's first instinct can do net damage. A plan-first prompt forces a checkpoint.
- **"I like your plan."** Tight approval signals the agent should proceed without further confirmations until done.

**What landed.** Reorganization to `tests/e2e/<feature>/<spec>.spec.ts`, kebab-case POM filenames, dead helpers removed. The plan-first checkpoint caught one incorrect rename before it shipped.

---

### P5.4 — Direct attention to a specific code smell

```
/playwright-e2e CardModal title selector — why did you use XPath? Use better
                alternatives. Use test-id instead. If not available add it or
                think of better alternative locators according to skill. Make
                sure you use Playwright MCP for refactoring any changes. Run
                tests at the end and fix any failing tests.
```

**Why this is its own prompt class.** Sometimes you don't want a broad audit — you have a specific smell in mind and want it eliminated without collateral edits. Naming the *smell* and the *file* keeps the blast radius small.

---

### P5.5 — Self-check the agent

> *"Did you use Playwright MCP to restructure this?"*
>
> *"After refactoring and restructuring, did you delete the old paths/folders and files which are unnecessary?"*

**Why these prompts are load-bearing.** The agent will sometimes claim to have followed an instruction it didn't follow. These two questions are the cheapest checks to catch that:

1. **"Did you use MCP?"** Catches the case where the agent inferred a selector from the React source instead of from the live DOM.
2. **"Did you delete the unused files?"** Catches the case where the agent created the new file but left the old one as a "just in case." A senior SDET cares about this — orphaned files become future false leads.

Both prompts forced corrections in this project's history. Trust, but verify.

---

## Lessons from this phase

- **Audits are cheap; apply them often.** A `/playwright-e2e <audit>` pass takes ~30 seconds of my time and catches drift before it compounds.
- **Always split audit from apply.** The agent's "fix everything you found" instinct is dangerous when the audit list has 12 items and 2 of them are wrong.
- **Plan-first for anything moving files.** Renaming is a refactor failure mode in disguise.
- **Don't accept "yes, done" without spot checks.** The two self-check questions in P5.5 are the cheapest insurance you can buy.
