import type { APIRequestContext, BrowserContext } from '@playwright/test';
import type { Credentials } from './test-data';
import { BoardCreatePayload, DEMO_CREDENTIALS } from './test-data';

interface BootstrapInput {
  projectName: string;
  boardName: string;
  credentials?: Credentials;
}

interface BootstrapResult {
  token: string;
  projectId: string;
  boardId: string;
}

interface SeededList {
  id: string;
  name: string;
  cards: { id: string; name: string }[];
}

interface SeededLayout extends BootstrapResult {
  lists: SeededList[];
}

interface SeededTwoBoardLayout extends BootstrapResult {
  list: { id: string; name: string };
  card: { id: string; name: string };
  secondBoard: { id: string; name: string };
  secondBoardList: { id: string; name: string };
}

interface SeededCardWithTasks extends BootstrapResult {
  list: { id: string; name: string };
  card: { id: string; name: string };
  tasks: { id: string; name: string }[];
}

// rbd-spaced positions: leaves gaps so the server's gap-based reordering doesn't have to renumber on every move.
const POSITION_STEP = 65535;
function positionFor(index: number): number {
  return POSITION_STEP * (index + 1);
}

// Cookie names + version are defined on the client at constants/Config.js and read at boot from
// utils/access-token-storage.js. Setting them on a Playwright BrowserContext makes the SPA load
// pre-authenticated, no UI login needed.
const ACCESS_TOKEN_COOKIE = 'accessToken';
const ACCESS_TOKEN_VERSION_COOKIE = 'accessTokenVersion';
const ACCESS_TOKEN_VERSION = '1';

export class ApiClient {
  readonly request: APIRequestContext;
  // Optional because the global setup/teardown sweep only needs the HTTP client — it has no
  // browser context to seed cookies on, and only `seedAuthCookies` reads this field.
  readonly context: BrowserContext | undefined;
  readonly baseURL: string;
  // Sails API origin. In docker (single-port production image) this equals baseURL. In `pnpm dev`
  // the SPA is on :3000 (webpack) and the API on :1337 (Sails), so this needs to be set
  // separately via E2E_API_BASE_URL.
  readonly apiBaseURL: string;

  constructor(request: APIRequestContext, context: BrowserContext | undefined, baseURL: string, apiBaseURL?: string) {
    this.request = request;
    this.context = context;
    this.baseURL = baseURL;
    // `pnpm dev` serves the SPA on :3000 (webpack) with no /api proxy to Sails on :1337,
    // so an unqualified apiBaseURL defaults to the Sails port. Single-origin deployments
    // (docker prod image, CI) override via E2E_API_BASE_URL.
    this.apiBaseURL = apiBaseURL || (baseURL.includes(':3000') ? baseURL.replace(':3000', ':1337') : baseURL);
  }

  private apiUrl(path: string): string {
    return `${this.apiBaseURL}${path}`;
  }

  // POST /api/access-tokens. Returns the JWT.
  async login(credentials: Credentials = DEMO_CREDENTIALS): Promise<string> {
    const res = await this.request.post(this.apiUrl('/api/access-tokens'), {
      data: { emailOrUsername: credentials.username, password: credentials.password },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.login failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: string };
    return body.item;
  }

  async createProject(token: string, name: string): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.apiUrl('/api/projects'), {
      headers: { Authorization: `Bearer ${token}` },
      data: { name },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.createProject failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: { id: string; name: string } };
    return body.item;
  }

  async createBoard(token: string, projectId: string, name: string): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.apiUrl(`/api/projects/${projectId}/boards`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, ...BoardCreatePayload },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.createBoard failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: { id: string; name: string } };
    return body.item;
  }

  async createList(token: string, boardId: string, name: string, position: number): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.apiUrl(`/api/boards/${boardId}/lists`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, position, isCollapsed: false },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.createList failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: { id: string; name: string } };
    return body.item;
  }

  async createCard(token: string, listId: string, name: string, position: number): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.apiUrl(`/api/lists/${listId}/cards`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, position },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.createCard failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: { id: string; name: string } };
    return body.item;
  }

  async createTask(token: string, cardId: string, name: string, position: number): Promise<{ id: string; name: string }> {
    const res = await this.request.post(this.apiUrl(`/api/cards/${cardId}/tasks`), {
      headers: { Authorization: `Bearer ${token}` },
      data: { name, position },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.createTask failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { item: { id: string; name: string } };
    return body.item;
  }

  // Cascades to boards, lists, cards, comments, etc. 404 is treated as success
  // so re-running cleanup after a manual delete (or a failed bootstrap) is safe.
  async deleteProject(token: string, projectId: string): Promise<void> {
    const res = await this.request.delete(this.apiUrl(`/api/projects/${projectId}`), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok() && res.status() !== 404) {
      throw new Error(`ApiClient.deleteProject failed: ${res.status()} ${await res.text()}`);
    }
  }

  async listProjects(token: string): Promise<{ id: string; name: string }[]> {
    const res = await this.request.get(this.apiUrl('/api/projects'), {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok()) {
      throw new Error(`ApiClient.listProjects failed: ${res.status()} ${await res.text()}`);
    }
    const body = (await res.json()) as { items: { id: string; name: string }[] };
    return body.items;
  }

  // Defense-in-depth purge: deletes every project whose name starts with one of the test
  // prefixes. Catches orphans left by interrupted runs (Ctrl+C, crashes) or by a partial
  // bootstrap failure where the per-test fixture's try/finally never got a chance to run.
  async purgeTestProjects(prefixes: readonly string[], credentials?: Credentials): Promise<number> {
    const token = await this.login(credentials);
    const projects = await this.listProjects(token);
    const stale = projects.filter((p) => prefixes.some((prefix) => p.name.startsWith(prefix)));
    for (const project of stale) {
      await this.deleteProject(token, project.id);
    }
    return stale.length;
  }

  // Set the same auth cookies the SPA writes after a UI login so subsequent navigations
  // are authenticated without going through the login form.
  async seedAuthCookies(token: string): Promise<void> {
    if (!this.context) {
      throw new Error('ApiClient.seedAuthCookies requires a BrowserContext');
    }
    const expires = ApiClient.decodeJwtExp(token);
    await this.context.addCookies([
      { name: ACCESS_TOKEN_COOKIE, value: token, url: this.baseURL, expires, sameSite: 'Strict' },
      { name: ACCESS_TOKEN_VERSION_COOKIE, value: ACCESS_TOKEN_VERSION, url: this.baseURL, expires, sameSite: 'Strict' },
    ]);
  }

  async bootstrapBoard({ projectName, boardName, credentials }: BootstrapInput): Promise<BootstrapResult> {
    const token = await this.login(credentials);
    await this.seedAuthCookies(token);
    const project = await this.createProject(token, projectName);
    // Roll back the project if anything past this point throws — otherwise the per-test
    // fixture never sees the projectId and its try/finally cleanup can't fire.
    try {
      const board = await this.createBoard(token, project.id, boardName);
      return { token, projectId: project.id, boardId: board.id };
    } catch (err) {
      await this.deleteProject(token, project.id).catch(() => undefined);
      throw err;
    }
  }

  // Bootstraps a board pre-seeded with the given list/card layout via API. Each list and card
  // is created sequentially so the server's gap-based positions land at predictable values.
  async bootstrapBoardWithLayout(
    input: BootstrapInput & { layout: { listName: string; cardNames: string[] }[] },
  ): Promise<SeededLayout> {
    const base = await this.bootstrapBoard(input);
    try {
      const lists: SeededList[] = [];
      for (let li = 0; li < input.layout.length; li += 1) {
        const spec = input.layout[li];
        const list = await this.createList(base.token, base.boardId, spec.listName, positionFor(li));
        const cards: { id: string; name: string }[] = [];
        for (let ci = 0; ci < spec.cardNames.length; ci += 1) {
          cards.push(await this.createCard(base.token, list.id, spec.cardNames[ci], positionFor(ci)));
        }
        lists.push({ ...list, cards });
      }
      return { ...base, lists };
    } catch (err) {
      await this.deleteProject(base.token, base.projectId).catch(() => undefined);
      throw err;
    }
  }

  // Bootstraps two boards in the same project, each with one list, plus a single card on the
  // first board. Used by the cross-board "Move card to another board" spec.
  async bootstrapTwoBoardLayout(
    input: BootstrapInput & { secondBoardName: string; firstListName: string; secondListName: string; cardName: string },
  ): Promise<SeededTwoBoardLayout> {
    const base = await this.bootstrapBoard(input);
    try {
      const secondBoard = await this.createBoard(base.token, base.projectId, input.secondBoardName);
      const list = await this.createList(base.token, base.boardId, input.firstListName, positionFor(0));
      const secondBoardList = await this.createList(base.token, secondBoard.id, input.secondListName, positionFor(0));
      const card = await this.createCard(base.token, list.id, input.cardName, positionFor(0));
      return { ...base, list, card, secondBoard, secondBoardList };
    } catch (err) {
      await this.deleteProject(base.token, base.projectId).catch(() => undefined);
      throw err;
    }
  }

  async bootstrapCardWithTasks(
    input: BootstrapInput & { listName: string; cardName: string; taskNames: string[] },
  ): Promise<SeededCardWithTasks> {
    const base = await this.bootstrapBoard(input);
    try {
      const list = await this.createList(base.token, base.boardId, input.listName, positionFor(0));
      const card = await this.createCard(base.token, list.id, input.cardName, positionFor(0));
      const tasks: { id: string; name: string }[] = [];
      for (let i = 0; i < input.taskNames.length; i += 1) {
        tasks.push(await this.createTask(base.token, card.id, input.taskNames[i], positionFor(i)));
      }
      return { ...base, list, card, tasks };
    } catch (err) {
      await this.deleteProject(base.token, base.projectId).catch(() => undefined);
      throw err;
    }
  }

  private static decodeJwtExp(token: string): number {
    const payload = token.split('.')[1];
    const json = Buffer.from(payload, 'base64').toString('utf8');
    return (JSON.parse(json) as { exp: number }).exp;
  }
}
