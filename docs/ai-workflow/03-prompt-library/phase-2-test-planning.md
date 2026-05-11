# Phase 2 — Test Planning

**Goal of this phase.** Produce a risk-based test plan ([`docs/test-plan.md`](../../test-plan.md)) that frames *what is in scope*, *what is deferred and why*, and *how much of the surface we cover today*. The plan is the steering document for every prompt after this.

**Why a plan when "you can just write tests"?** Because every test costs runtime + maintenance forever, and the cheapest test is the one you decided not to write. A senior SDET's value is mostly in subtraction.

---

## Prompts

### P2.1 — Generate the first draft, no external requirements

```
/test-plan-generation Review the 4GABoards project. It contains development code
                      as well. Recently added some Playwright e2e tests.
                      Requirements are not provided. Instead, read or understand
                      the entire project from development code. Generate a test
                      plan for this.
```

**Why this prompt is shaped this way.**
- **Skill-driven** (`/test-plan-generation`). The skill carries the structure (overview / scope / strategy / risks / coverage matrix / exit criteria). I don't repeat any of that.
- **States the constraint upfront**: no requirements doc. Tells the agent to derive intent from code, models, routes, and existing tests — and to be honest about that being the source.
- **Hands over an existing artifact** (the early Playwright tests) so the plan can describe *current coverage* vs. *required coverage*, not start from zero.

**What came back.** A 44 KB markdown plan with: 22 risks (R-01 … R-22), a coverage matrix, an honest "30 of ~200 user journeys covered (~15%)" baseline, and a §3.6 "Tests that are NOT good E2E candidates" section that flagged 11 tests to deactivate.

---

### P2.2 — Persist the artifact

> *"This is a good test plan. Store it in `docs/test-plan.md`."*

**Why this is its own prompt.** I want the plan in the repo, not the chat. From this point on, it's a referable artifact — every later prompt can say *"per §2.2 of the test plan…"* and the agent can pull the section from the file.

---

### P2.3 — Iterate the plan as the suite evolves

```
/test-plan-generation With the recent changes in test cases and increase in
                      coverage of tests and some tests dropped, update the test
                      plan. Think like a principal SDET test architect and
                      update the test plan.
```

**Why this prompt is shaped this way.**
- **"Think like a principal SDET test architect."** Role-framing is not magic, but it shifts the agent away from cheerleading additions and toward subtraction decisions (the harder, more senior move).
- **Names the deltas.** "Increase in coverage" + "some tests dropped" tells the agent the §3.6 deactivation list and the new DnD specs both need to land in the plan — coverage% goes up *and* test count goes down.

**What worked.** Updating the plan after every meaningful suite change kept the "15% covered" number honest. A stale plan is worse than no plan.

---

### P2.4 — Stress-test the plan's omissions

> *"Critique the test plan as if you were reviewing it before sign-off. What's the weakest section? What category of user is least represented? If we had to ship and remove one in-scope area, which one and why?"*

**Why this exists.** Plans tend to grow; they rarely get trimmed. This prompt forces an adversarial pass that surfaces the "we listed it but never costed it" sections.

**What came back.** Useful pushback on the OAuth section (correctly flagged as Out-of-Scope vs. Deferred — they're different things), and a fair callout that the multi-tab websocket scope was understated relative to its risk weight.

---

## Anti-prompts (things I deliberately did not do)

- ❌ *"Write me a complete test plan."* — Too open-ended; produces a wall of generic deliverable boilerplate, no risk weighting.
- ❌ *"What should we test?"* — Same problem. The skill exists so I can say "do the structured thing" without re-specifying.
- ❌ Pasting the plan back into chat to edit. Once it's in `docs/test-plan.md`, the agent reads it from disk and edits surgically.

## Lessons from this phase

- **A skill is the right vehicle for a templated artifact.** Test plans, ADRs, post-incident reviews — anything with a known structure and variable content.
- **Honest baselines beat aspirational ones.** "15% of ~200 journeys" is more useful than "comprehensive coverage" because it tells me where to invest next.
- **Risk numbering pays off late.** The R-04 (OAuth), R-13 (DnD timing), R-22 (multi-tab) labels became shorthand in later prompts — much faster than re-describing each risk.
