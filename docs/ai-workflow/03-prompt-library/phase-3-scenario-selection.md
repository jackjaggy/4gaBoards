# Phase 3 — Scenario Selection ("Is this a good E2E candidate?")

**Goal of this phase.** Turn the test plan's coverage matrix into a *ranked list of specs to write next* — and just as importantly, **a list of specs not to write**. The most senior signal in test automation is knowing when not to automate at the E2E layer.

**The rubric in my head.** A test is a good E2E candidate when:
1. The bug it catches would only manifest when *multiple layers* interact (UI + saga + REST + WS + DB).
2. The same coverage at a cheaper layer (Jest component, mocha integration) would miss something real.
3. The journey reflects a *user-visible promise* (login, drag a card, see it persist).

It is a *bad* E2E candidate when:
1. It's testing client-side form validation that React handles synchronously.
2. It's testing an HTTP response shape that supertest could verify in ~50ms.
3. It depends on a confirmation modal whose text is a UI string subject to i18n churn.

The prompts below are the ones that drove the rubric in practice.

---

## Prompts

### P3.1 — Mine new scenarios, bounded

> *"We already have some end to end tests for critical user journeys at `tests/e2e`. Now identify few more test scenarios that are good candidates for end to end automation and critical for user journeys. Please include both happy path and negative scenarios. Give me max 10 scenarios. I will go through them and identify good candidates which I want to add automation tests."*

**Why this prompt is shaped this way.**
- **"Max 10."** Without a cap, the agent will produce 30, half of which are duplicates of existing coverage. The cap forces ranking.
- **"Both happy path and negative."** Otherwise you get 10 happy-paths; negatives are the weight class where E2E earns its cost.
- **"I will go through them."** Sets the expectation that this is a menu, not an instruction — the agent should optimize for *my decision quality*, not for trying to be helpful by also writing the code.

---

### P3.2 — Push for the harder cases

> *"The above list looks good. Give me few more negative scenarios that are good candidates for end to end automation and critical for user journeys."*

**Why a separate prompt.** Splitting "happy" and "negative" into two prompts produces better negatives. Combined prompts default to happy-path framing. This is a small thing but it changed the quality of suggestions noticeably.

---

### P3.3 — Cost-check before committing

> *"These are test scenarios I have identified I want to automate for end to end automation. Are these scenarios easily testable using current local setup and Playwright?"*

**Why this matters.** Scenario lists tend to ignore *what it takes to set them up*. This prompt forces the agent to check:
- Does the local stack support it (no external IdP, no SMTP, no S3)?
- Is the precondition cheaper via UI or via `ApiClient.bootstrapBoard*`?
- Is there a deterministic wait, or does it depend on a wall-clock-y cron?

**What came back.** The agent correctly flagged the "Notification email arrives" scenario as **not** locally testable (it requires the external notifications microservice), and proposed a substitution: assert that the `Notification` row is created and `deliveredAt` is set by the cron, which *is* testable here. That's exactly the substitution a senior SDET would make.

---

### P3.4 — Audit existing tests against the rubric

> *"Go through the current tests at `tests/e2e`. My main goal is to have end to end tests for the current project with some coverage, not exhaustive/comprehensive coverage. Also a test plan is available at `docs/test-plan.md` — not sure, you can refer it but I am not sure if it's accurate. As a Senior/Principal SDET test architect, go through the current tests and analyze if they are good candidates for end to end automation. Give me the reasoning if you identify any tests not candidates for end to end automation."*

**Why this prompt is shaped this way.**
- **Honest about the plan being possibly stale.** "I am not sure if it's accurate" — gives the agent permission to disagree with the plan, not slavishly follow it.
- **"With some coverage, not exhaustive."** Pre-empts the agent's instinct to recommend more tests.
- **"Reasoning if you identify any tests NOT candidates."** Asks for the subtraction, with justification.

**What came back.** The "Tests that are NOT good E2E candidates" analysis that became plan §3.6:
- **8 client-side empty/whitespace input guards** (auth, kanban, comments) — synchronous React; belongs in Jest.
- **2 confirmation-dialog cancel guards** — i18n-fragile; not load-bearing journey behavior.
- **1 multi-step ambiguous case** flagged for re-evaluation.

Net: 11 tests commented out (not deleted — see [`../04-case-studies/cs-03-deactivate-vs-delete.md`](../04-case-studies/cs-03-deactivate-vs-delete.md)).

---

### P3.5 — Hunt negative-path gaps after the positive sweep

> *"Go through the current end to end tests - `tests/e2e`. I think currently we just have positive happy scenarios. If there are no negative scenarios in the current tests, identify good negative scenarios for end to end automation that we can add to our current features tested."*

**Why this prompt exists.** Even after the rubric audit, the suite was skewed positive. This sweep specifically asks "what's the negative-path gap *within the features we already cover*" — different from P3.2, which adds whole new scenarios.

---

### P3.6 — Look for low-cost wins

> *"Identify 2 more features that are easy and convenient to test for end to end UI automation. Consider both happy path and negative validation cases. Provide top test scenarios (4 each) for end to end UI automation for critical user journeys that are testable for these 2 features."*

**Why "easy and convenient" is a real constraint.** Not every coverage gap is worth filling immediately. This prompt asks the agent to optimize for **return per hour of authoring**, not for completeness. It's how you find the next two wins, not the next two ratholes.

---

## Lessons from this phase

- **The most senior prompts are subtraction prompts.** "What should we *not* automate at this layer" is harder for an LLM (and most humans) than "what should we automate" — and more valuable.
- **Cap the output.** "Max 10" and "4 each" produce better lists than open-ended asks.
- **Make the rubric explicit.** "Easy and convenient", "Are these testable with the current local setup", "Both happy and negative" — each constraint shapes the answer.
- **Use the agent as a sparring partner, not an oracle.** Every output here was a menu I edited, not a decision I accepted whole.
