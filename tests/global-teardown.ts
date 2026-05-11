// Runs once after the entire Playwright test suite. The per-test fixtures already delete
// their projects in a try/finally, but a hard interrupt (Ctrl+C, watch-mode reload, crash)
// or a partial bootstrap failure can still leak rows. This sweep deletes anything whose
// name starts with the test prefix so the demo dashboard never accumulates orphans.

import { request } from '@playwright/test';
import { ApiClient } from './utils/api-client';
import { NamePrefixes } from './utils/test-data';

const TEST_NAME_PREFIXES = [NamePrefixes.project, NamePrefixes.board] as const;

export default async function globalTeardown(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const ctx = await request.newContext({ baseURL });
  // No BrowserContext needed — purgeTestProjects only uses the HTTP client.
  // ApiClient defaults apiBaseURL to the Sails port (:1337) when only the SPA URL is known.
  const api = new ApiClient(ctx, undefined, baseURL, process.env.E2E_API_BASE_URL);
  try {
    const purged = await api.purgeTestProjects(TEST_NAME_PREFIXES);
    if (purged > 0) {
      // eslint-disable-next-line no-console
      console.log(`[tests/global-teardown] purged ${purged} leftover test project(s)`);
    }
  } finally {
    await ctx.dispose();
  }
}
