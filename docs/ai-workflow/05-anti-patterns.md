# Anti-Patterns — what I asked the agent *not* to do

A library of *don'ts* is at least as useful as a library of *do's*. The negative space tells the reviewer what you've already considered and rejected.

This file collects the prohibitions I encoded — sometimes in the skill, sometimes inline in prompts, sometimes via post-hoc corrections.

---

## Code-level anti-patterns

### ❌ `waitForTimeout(...)`

**Why.** Wall-clock waits are flake amplifiers. They pass on a fast machine, fail under CI load, and teach the team to retry instead of debug.

**Replacement.** Wait on the specific event: `waitForResponse`, websocket ack frame, `expect(locator).toHaveText(...)`, or a `data-testid` mutation.

**Prompt that drove the cleanup:**
> *"Fix `waitForTimeout(60)` in DnD — actual flake risk on CI."*

### ❌ CSS prefix selectors like `[class*=SomeModule_]`

**Why.** CSS-Module class hashes change on rebuild. A selector that works today breaks next bundle.

**Replacement.** `getByRole`, `getByTestId`, or `getByLabel`. Add a `data-testid` to the React component if none exists.

**Prompt:**
> *"Replace `[class*=...]` CSS prefix selectors. Use Playwright MCP to confirm the role/testid exists before each replacement."*

### ❌ XPath

**Why.** Brittle, unreadable, ignores the accessibility tree.

**Replacement.** Same as above. If the agent uses XPath, push back hard:
> *"CardModal title selector — why did you use XPath? Use better alternatives. Use test-id instead. If not available add it or think of better alternative locators according to skill."*

### ❌ UI-driven test setup when API-driven is available

**Why.** Slower, less deterministic, mixes the test under test with the feature setting it up.

**Replacement.** `ApiClient.bootstrapBoard*` family of fixtures. See [`04-case-studies/cs-02-api-driven-bootstrap.md`](./04-case-studies/cs-02-api-driven-bootstrap.md).

### ❌ Tests that depend on previous tests' state

**Why.** Order-dependent tests are landmines. One reorder, one parallelism bump, suite goes red.

**Replacement.** Every test runs against a fresh fixture. Every fixture cleans up after itself.

### ❌ Asserting on i18n strings as the journey signal

**Why.** Translation churn breaks tests that have nothing to do with the feature.

**Replacement.** Assert on roles, structure, or `data-testid`. If you must assert on text, use the message constants from [`tests/utils/messages.ts`](../../tests/utils/messages.ts) so the source of truth is one file, not 30 specs.

### ❌ Comments that explain *what*

**Why.** Well-named code already says what it does. Comments rot faster than code.

**Allowed.** Comments that explain *why* a non-obvious choice was made — for example, the constructor-time websocket listener in `card-modal.page.ts`. See [`cs-01-drag-and-drop-websocket.md`](./04-case-studies/cs-01-drag-and-drop-websocket.md) for the canonical example.

### ❌ Testing client-side input validation at the E2E layer

**Why.** Synchronous React validation. No async, no integration, no journey. The wrong layer.

**Replacement.** Jest. See [`cs-03-deactivate-vs-delete.md`](./04-case-studies/cs-03-deactivate-vs-delete.md) for the 11 tests demoted on this basis.

---

## Workflow / agent-behavior anti-patterns

### ❌ Letting the agent author code without first probing the DOM

**Symptom.** The agent invents a selector that compiles but doesn't match anything live.

**Defense:**
> *"Before writing the spec, open the page with MCP and snapshot the accessibility tree. Tell me the role and accessible name of the element you plan to target."*

### ❌ Accepting the agent's audit findings wholesale

**Symptom.** Out of 12 findings, 2 are wrong; "apply all" introduces a regression.

**Defense.** Split audit from apply (Phase 5, P5.1 → P5.2). Reject the findings that don't hold up.

### ❌ Letting the agent "fix it and proceed" on pre-merge gates

**Symptom.** Agent helpfully patches a broken test mid-run, hiding a real regression.

**Defense:**
> *"If anything is red, stop and tell me — do not commit until I say so."*

### ❌ Trusting the agent's claim that it followed an instruction

**Symptom.** Agent says it used MCP; really inferred from React source.

**Defense.** Cheap verification questions:
> *"Did you use Playwright MCP to restructure this?"*
> *"After refactoring, did you delete the old paths/folders and files which are unnecessary?"*

Both questions caught real lapses in this project.

### ❌ Open-ended generation prompts ("write me a test plan", "test everything")

**Symptom.** Wall of boilerplate, no risk weighting, low signal.

**Defense.** Use skills (templated structure) + constraints (max N, cost-checked, layer-aware). See Phase 2 prompts for the shape.

### ❌ Re-pasting standards into every chat

**Symptom.** Drift, inconsistency, untransferable knowledge.

**Defense.** Standards live in `.claude/skills/<name>/SKILL.md` and `CLAUDE.md`. Prompts say "according to skill," not "here are the 17 rules again."

### ❌ Letting CLAUDE.md grow into a tutorial

**Symptom.** Every session burns tokens on info the agent already knows.

**Defense.** CLAUDE.md = what's surprising about *this* repo. Not what Sails is. Not what Playwright is. Just the local conventions.

---

## The meta anti-pattern

**❌ Treating the agent as an oracle.**

It's a fast, fluent, sometimes-wrong collaborator. The senior-SDET workflow treats it as a *force multiplier under supervision* — not as a labor-replacement. Every artifact in this submission was reviewed, often corrected, and occasionally rejected. The corrections are part of the work, not a failure of the work.
