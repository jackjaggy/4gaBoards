# Phase 7 — Hygiene & Ship

**Goal of this phase.** Get the suite green, the test data clean, the repo's `.gitignore` correct, and the branch ready for PR. A test suite that leaves seed data on the dev DB after every run *will* be ignored.

---

## Prompts

### P7.1 — Force the teardown question

```
/playwright-e2e Tests are generating data every time I run tests. When I log in
                to http://localhost:3000/ I could find lots of data. Isn't the
                best practice to clean up test data after each run or test case
                completion?
```

Then:

> *"Implement the per-test teardown."*

**Why this prompt is shaped this way.**
- **State the observation, not the diagnosis.** "I see leftover data when I log in." Lets the agent figure out the cause instead of being primed by my (possibly wrong) theory.
- **Rhetorical "isn't best practice…?"** Sets the expected direction without dictating implementation. The agent can choose between fixture-lifecycle cleanup, `afterEach`, or `globalTeardown` — and tell me which is right here.

**What landed.** Cleanup moved into each fixture's `use()` lifecycle, so cleanup is colocated with creation and runs even when assertions fail mid-test. `ApiClient.cascadeDelete*` calls handle the dependent rows.

---

### P7.2 — Audit *new* tests for the same hygiene gap

```
/playwright-e2e I see for the newly generated tests, test data was not cleaned
                up after testing is done. I see the board on
                http://localhost:3000/ is getting filled up again. I think
                earlier tests have a test data cleanup mechanism, but newly
                added tests do not have it. Check it out and if it does not
                have data cleanup, add it.
```

**Why this exists.** Teardown is the kind of thing the agent will follow on the *first* batch of tests, then quietly skip on the *next* batch because the immediate prompt was about something else. Periodic re-audits catch the drift.

---

### P7.3 — Pre-merge changeset review

> *"I want to commit and push all the changes in my local branch and create a MR. As you know I recently added the e2e tests and related framework and MCP, and Claude skills etc. Go through all the changes and suggest any updates to `.gitignore` file and any other files that should not be pushed to GitHub."*

**Why this prompt is shaped this way.**
- **Names the scope.** "Recently added e2e tests, framework, MCP, skills" gives the agent the categories to look for.
- **"Suggest any updates to `.gitignore`."** Specifically asks for the file that catches almost-shipped junk.
- **"Files that should not be pushed."** Casts the net wider than just `.gitignore` (e.g. local-only settings, scratch traces).

**What came back.**
```diff
+# Playwright
+test-results/
+playwright-report/
+.playwright-mcp/
```

Three entries, each catching a real category of churn:
- `test-results/` — Playwright HTML report artifacts per run.
- `playwright-report/` — the rendered HTML report.
- `.playwright-mcp/` — MCP browser traces (large, ephemeral, debug-only).

The `.claude/settings.local.json` correctly stays *out* of `.gitignore` — it's project-scoped intent worth versioning.

---

### P7.4 — Run the whole show one last time before pushing

> *"Bring up the stack, run the full E2E suite headless, confirm 30/30 pass. If anything is red, stop and tell me — do not commit until I say so."*

**Why this prompt is shaped this way.**
- **"Bring up the stack."** Single command does the multi-step thing.
- **"Confirm 30/30 pass."** Names the expected number — the agent reports the *delta* if anything dropped.
- **"Stop and tell me — do not commit."** Explicit fence. The agent's helpfulness instinct is to fix and proceed; for the pre-merge gate, that's wrong.

---

## Lessons from this phase

- **Cleanup is a feature, not a chore.** A suite that doesn't clean up will rot the dev environment and discredit itself.
- **Re-audit after every batch.** New tests skip patterns the old tests followed. The cheap defense is a periodic skill-audit.
- **`.gitignore` is part of the deliverable.** Adding it to the changeset signals you thought about what *not* to ship.
- **The pre-merge gate gets its own fence.** Explicit "stop, don't commit" prompts prevent the agent's helpfulness from racing ahead.
