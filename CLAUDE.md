# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository layout

This is a pnpm workspace monorepo (`pnpm-workspace.yaml`) for **4ga Boards**, a Trello-like project management app.

- [client/](client/) — React 18 SPA, custom Webpack build (forked from CRA in `client/scripts/`). Entry: [client/src/index.js](client/src/index.js).
- [server/](server/) — Sails.js 1.x API + WebSocket backend on PostgreSQL. Entry: [server/app.js](server/app.js).
- [packages/](packages/) — Workspace-local libraries consumed by both client and server: `@4gaboards/enums`, `@4gaboards/locales`, `@4gaboards/utils`. They must be built before tests/dev (`packages:build`); most root scripts do this automatically via `pre*` hooks.
- [tests/](tests/) — Playwright tests against a running stack ([playwright.config.ts](playwright.config.ts)).
- [eslint-configs/](eslint-configs/) — shared ESLint config consumed by per-package `eslint.config.mjs`.

## Common commands

All commands use **pnpm** (enforced by `devEngines`). Node `^24.11`, pnpm `^10.33`.

### Development

```bash
pnpm i                                         # install
cp server/.env.sample server/.env              # required for server
docker compose -f docker-compose-dev.yml up -d # postgres on :5432 (trust auth, no password)
pnpm server:db:init                            # init schema + seed demo user
pnpm dev                                       # builds packages, runs server + client + watch-rebuild of packages
```

`pnpm dev` runs three concurrent processes (`concurrently -n server,client,packages`). The client dev server proxies to the Sails server; default URL is http://localhost:3000, demo creds `demo` / `demo`.

### Lint & test

```bash
pnpm lint                  # parallel lint across all workspaces
pnpm client:lint           # JS + stylelint
pnpm client:lint:styles:fix
pnpm server:lint           # eslint with --max-warnings=0
pnpm test                  # builds packages, then server (mocha) + client (jest)
pnpm client:test           # jest --watch (CRA-style runner via client/scripts/test.js)
pnpm client:ci:test        # one-shot jest, used by translations agent to detect missing locale keys
pnpm server:test           # mocha test/lifecycle.test.js test/integration/**/*.test.js test/utils/**/*.test.js
```

Run a single client test:
```bash
pnpm -C client test -- --testPathPattern <path-fragment>
```
Run a single server test:
```bash
pnpm -C server exec mocha test/integration/path/to/file.test.js
```

### E2E (Playwright)

`test:e2e` does **not** start the app — bring up the full stack first (`pnpm dev` or docker), then:

```bash
pnpm test:e2e                # headless
pnpm test:e2e:ui             # Playwright UI mode, E2E_SLOWMO=1000
pnpm test:e2e:headed         # headed, E2E_SLOWMO=1000
pnpm test:e2e:report         # open last HTML report
E2E_BASE_URL=http://host:port pnpm test:e2e   # override target
E2E_API_BASE_URL=http://host:port pnpm test:e2e   # override Sails API target
```

Config: `fullyParallel: false`, `workers: 2`, chromium + firefox projects. Helpers and fixtures live in [tests/utils/](tests/utils/) and [tests/fixtures/](tests/fixtures/); page objects in [tests/pages/](tests/pages/). Tests assume the demo user (`demo`/`demo`) and the demo user's avatar shows initials `DD`. Global setup/teardown ([tests/global-setup.ts](tests/global-setup.ts), [tests/global-teardown.ts](tests/global-teardown.ts)) purge test-prefixed projects to keep the dashboard clean.

There is also a Playwright MCP server configured in [.mcp.json](.mcp.json) — `npx -y @playwright/mcp@latest --headless --isolated`.

### Database (Knex, server-side)

```bash
pnpm server:db:init              # full init (used on first run)
pnpm server:db:migrate           # latest
pnpm server:db:rollback_one      # one step
pnpm server:db:rollback          # full rollback
pnpm server:db:migration_make    # creates db/migrations/<ts>_new_migration.js
pnpm server:db:seed
```

Knex commands run with `--cwd db` against `server/db/knexfile.js`.

## Architecture

### Domain model (mirrored on both sides)

The same entity graph appears in [server/api/models/](server/api/models/) (Waterline ORM via Sails) and [client/src/models/](client/src/models/) (Redux-ORM). Keep them aligned when adding fields.

Hierarchy: **Project → Board → List → Card → Task**, with cross-cutting `Label`, `Comment`, `Attachment`, `Action` (activity), `Notification`, `User`, `BoardMembership`, `ProjectMembership`, `ProjectManager`, `ApiClient`, `MailToken`.

### Server (Sails.js)

- Routes are explicit in [server/config/routes.js](server/config/routes.js) — no blueprint auto-routing. Most endpoints map to actions under [server/api/helpers/<resource>/](server/api/helpers/) (e.g. `cards/create-one.js`) rather than controllers; the only controller is `AuthController.js` for OAuth flows.
- Business logic lives in **helpers** organized by resource (`cards/`, `boards/`, `lists/`, `users/`, …). New endpoints typically mean: add a helper, register the route in `routes.js`.
- WebSocket events are emitted via `sails-hook-sockets`; the client subscribes through [client/src/sagas/core/services/socket.js](client/src/sagas/core/services/socket.js).
- Custom hooks in [server/api/hooks/](server/api/hooks/): `current-user`, `metrics` (prom-client), and two cron hooks (`cron-failed-auths-cleanup`, `cron-notifications-batching`).
- Auth: local + Passport strategies for Google / GitHub / Microsoft / OIDC, configured in `server/strategies/` and `server/config/passport.js`.

### Client (React + Redux-Saga + Redux-ORM)

State is a Redux-ORM session (`client/src/orm.js`) driven by sagas. Layout under [client/src/](client/src/):

- `components/` — view layer (presentational + container-ish). `Core/` is the app shell.
- `containers/` — `connect()`ed wrappers binding components to selectors and entry-actions.
- `entry-actions/` — action creators dispatched from UI; they are observed by **watchers**.
- `actions/` — internal "result" actions emitted by services (after API calls succeed).
- `sagas/core/{watchers,services,requests}/` — the saga pipeline:
  - **watchers** listen for entry-actions,
  - **services** orchestrate optimistic updates + API calls,
  - **requests** wrap raw HTTP via [client/src/sagas/core/request.js](client/src/sagas/core/request.js).
- `api/` — fetch wrappers per resource (called from services).
- `models/` — Redux-ORM models keyed off API responses.
- `selectors/` — reselect selectors over the ORM session.

When adding a feature end-to-end, the typical chain is: API wrapper → request saga → service saga → watcher → entry-action → container → component, with a parallel result-action + reducer/ORM update path.

### Packages

- `@4gaboards/locales` — i18next locale bundles. **English is the source of truth** ([packages/locales/src/en/](packages/locales/src/en/), excluding `index.js`); other languages are populated by the translation flow described in [.github/agents/translations.agent.md](.github/agents/translations.agent.md). `pnpm client:ci:test` reports missing keys.
- `@4gaboards/enums`, `@4gaboards/utils` — shared constants and helpers.

Anything depending on these packages reads built output, so re-run `pnpm packages:build` (or rely on `pnpm dev`'s package watcher) after editing them.

## Conventions

- Commit style: **Conventional Commits**, capitalized subject, no trailing period (see [docs/CONTRIBUTING.md](docs/CONTRIBUTING.md)). Husky + lint-staged run lint on changed files only — see `lint-staged` in [package.json](package.json).
- Code style: Airbnb JS + Prettier (`printWidth: 210`, single quotes, trailing commas). Imports are sorted by `eslint-plugin-perfectionist` with React grouped first, then external/internal, then siblings, then plain CSS, then `*.module.scss`.
- Locale edits: preserve placeholders (`{{count}}`) and tag fragments (`<card>...</card>`) verbatim; for languages with apostrophes use double-quoted strings (e.g. `"I'l a une description"`) rather than escaping.
- Only one lockfile is allowed: `yarn.lock` and `package-lock.json` are git-ignored to enforce pnpm.
