# Case Study 03 — Deactivate, Don't Delete (11 tests pulled out of E2E)

**The decision.** After a rubric pass against the suite, 11 tests were identified as **not appropriate at the E2E layer**. Most teams would either (a) leave them in and shrug at the cost or (b) delete them and lose the institutional memory.

**What I did.** Commented them out in place, with a header rationale block explaining *why*, so the test author and any future engineer can see:
1. That they were considered.
2. Why they were demoted.
3. Where the right layer is (usually Jest component).

This is a one-paragraph case study with an outsized senior-SDET signal: it's a **subtraction** with **traceability**.

---

## The rubric the agent applied

A test is **not** a good E2E candidate when it tests behavior that:
- Is **synchronous** in React (form validation, empty-input guards) — no async layer to integrate.
- Is **i18n-fragile** (asserting on confirmation modal copy that's a translation string).
- Has **cheaper coverage at another layer** with no loss of fidelity (component tests, supertest API tests).

---

## The prompt that drove the audit

> *"Go through the current tests at `tests/e2e`. My main goal is to have end to end tests for the current project with some coverage, not exhaustive/comprehensive coverage. Also a test plan is available at `docs/test-plan.md` — not sure, you can refer it but I am not sure if it's accurate. As a Senior/Principal SDET test architect, go through the current tests and analyze if they are good candidates for end to end automation. Give me the reasoning if you identify any tests not candidates for end to end automation."*

(Same as P3.4 in the prompt library.)

---

## What came back

| Category | Tests | Why not E2E | Better home |
|---|---:|---|---|
| Empty / whitespace input guards (`auth.spec.ts`, `kanban.spec.ts`, `comments.spec.ts`) | 8 | Synchronous React validation. No backend round-trip. | Jest component tests |
| Confirmation dialog cancel guards | 2 | Asserts on translated copy. Brittle to i18n. No journey value. | Jest |
| Multi-step ambiguous case | 1 | Tests a transition that's already covered by a happier-path spec. | Drop |

Total: **11 tests deactivated.**

---

## The follow-up prompt that locked in the practice

> *"Don't delete the 11 tests. Comment them out in place, with a header block at the top of each spec listing which tests were demoted and why. I want the next engineer to see this happened, see the reasoning, and either re-activate (if I was wrong) or migrate to Jest (if I was right). A diff that just deletes them loses that signal."*

**Why this is the senior move.**
- **`git blame` is great, comment blocks are better.** The reasoning is visible without leaving the file.
- **Future re-activation is cheap.** Uncomment, run.
- **Migration is queued, not lost.** Each commented test is a TODO with full context.
- **Code review can see the decision.** The PR shows the additions as comment lines, not a wall of red.

---

## What this case study demonstrates

| Skill | Evidence |
|---|---|
| Subtraction as a senior move | 11 tests cut, ~25% smaller suite |
| Layer-appropriate testing | Demoted to Jest, not deleted |
| Traceability of judgment calls | Header block in each spec |
| Cheap reversal path | Uncomment, run |
| Code as documentation of intent | Comment block beats a Slack thread |
