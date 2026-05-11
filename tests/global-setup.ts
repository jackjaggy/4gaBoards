// Runs once before the suite. Sweeps any test-prefixed projects that survived a previous
// interrupted run so each session starts against a clean dashboard, which keeps tests that
// assert project counts or scroll-into-view behaviour deterministic.

import { request } from '@playwright/test';
import { ApiClient } from './utils/api-client';
import { NamePrefixes } from './utils/test-data';

const TEST_NAME_PREFIXES = [NamePrefixes.project, NamePrefixes.board] as const;

export default async function globalSetup(): Promise<void> {
  const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
  const ctx = await request.newContext({ baseURL });
  // ApiClient defaults apiBaseURL to the Sails port (:1337) when only the SPA URL is known —
  // see api-client.ts. Pass E2E_API_BASE_URL through verbatim when set; otherwise let it default.
  const api = new ApiClient(ctx, undefined, baseURL, process.env.E2E_API_BASE_URL);
  try {
    const purged = await api.purgeTestProjects(TEST_NAME_PREFIXES);
    if (purged > 0) {
      // eslint-disable-next-line no-console
      console.log(`[tests/global-setup] purged ${purged} leftover test project(s) from a previous run`);
    }
  } finally {
    await ctx.dispose();
  }
}
