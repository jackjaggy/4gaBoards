# Context engineering — MCP server & permission allowlist

Two pieces of plumbing that paid for themselves many times over.

## 1. Playwright MCP server (`.mcp.json`)

```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@playwright/mcp@latest", "--headless", "--isolated"]
    }
  }
}
```

### What this changes

Without an MCP browser, the agent can only *guess* at the DOM from React source. With it, the agent can **navigate the running app, snapshot the accessibility tree, click, type, evaluate JS, capture console errors and network traffic** — all from inside the same chat where it's authoring tests.

The single most valuable consequence: **selector decisions are evidence-based**. When I prompted "use a `data-testid`, and if none exists add one", the agent first opened the modal via `mcp__playwright__browser_snapshot`, saw what was actually rendered, and *then* either reused a `data-testid` or added one to the React component — instead of inventing a selector and hoping.

### Use cases that came up

| Situation | MCP call that mattered |
|---|---|
| "Why is this DnD test flaky?" | `browser_console_messages` + `browser_network_requests` to see if a Socket.IO ack was racing the reload |
| "What's the accessible name of this button?" | `browser_snapshot` — the AOM tree shows it, no inference needed |
| "Does this rbd live-region announcement fire?" | `browser_evaluate` to read the announcement region's text |
| "Refactor this XPath to a `getByRole`" | `browser_snapshot` to confirm the role exists before the edit |

### The prompt that drilled the habit in

> *"CardModal title selector — why did you use XPath? Use better alternatives. Use test-id instead. If not available, add it or think of better alternative locators according to skill. Make sure you use Playwright MCP for refactoring any changes. Run tests at the end and fix any failing tests."*

That single message taught the agent to: (a) self-justify selector choices, (b) reach for MCP before guessing, (c) close the loop by re-running.

## 2. Permission allowlist (`.claude/settings.local.json`)

The agent prompts for permission on each new tool/command. Helpful at first, friction after the 50th identical prompt. The fix is a **scoped allowlist** — not "allow everything", just the exact commands I know are safe.

The shape that works:

```jsonc
{
  "permissions": {
    "allow": [
      "mcp__playwright__browser_click",
      "mcp__playwright__browser_navigate",
      "mcp__playwright__browser_snapshot",
      "Bash(pnpm exec *)",
      "Bash(npx playwright *)",
      "Bash(pnpm test:e2e)",
      "Bash(E2E_BASE_URL=* E2E_API_BASE_URL=* pnpm exec playwright test --project=chromium *)"
    ]
  },
  "enabledMcpjsonServers": ["playwright"]
}
```

### Principles I followed

- **Allow shape, not just exact strings.** `Bash(pnpm exec *)` covers a long tail of `pnpm exec` invocations without re-prompting.
- **Never blanket-allow `Bash`.** I want a prompt before anything outside the test/dev surface.
- **Per-project, not per-user.** Lives at `.claude/settings.local.json` so it ships with the branch but doesn't pollute global state. (Could be promoted to `settings.json` for the whole team once stable.)

### What I refused to allow

- Anything that mutates git remote state (`git push`, `git push -f`).
- Anything destructive (`rm -rf`, `git reset --hard`, `pnpm install` of arbitrary packages).
- Network calls to anything other than `localhost:1337` / `localhost:3000`.

For those, the prompt-on-each-use friction is *correct* — it's a circuit breaker.

## Why this section matters for the report

Anyone can paste prompts into a chat box. The investment in **MCP + permissions** is what separates a senior-SDET workflow from a junior one — it's the difference between an agent that *describes* what it would do and one that *does it, observes the result, and corrects*. The cost is small (two config files), the leverage is large.
