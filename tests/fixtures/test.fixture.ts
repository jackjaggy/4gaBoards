// Custom Playwright fixtures: lift Page-Object construction and the API-driven board bootstrap
// out of every test file. Tests opt in to the layers they need (page objects, ready board,
// board with a card, opened card modal) via destructuring.

import { test as base } from '@playwright/test';
import { BoardPage } from '../pages/board.page';
import { CardModalPage } from '../pages/card-modal.page';
import { HeaderComponent } from '../pages/header.component';
import { LoginPage } from '../pages/login.page';
import { ApiClient } from '../utils/api-client';
import { uniqueName } from '../utils/helpers';
import { NamePrefixes } from '../utils/test-data';

interface BootstrappedBoard {
  token: string;
  projectId: string;
  boardId: string;
}

interface BoardWithCardContext {
  boardId: string;
  cardName: string;
}

interface BoardWithLayoutContext extends BootstrappedBoard {
  lists: { id: string; name: string; cards: { id: string; name: string }[] }[];
}

interface TwoBoardLayoutContext extends BootstrappedBoard {
  list: { id: string; name: string };
  card: { id: string; name: string };
  secondBoard: { id: string; name: string };
  secondBoardList: { id: string; name: string };
}

interface CardWithTasksContext extends BootstrappedBoard {
  list: { id: string; name: string };
  card: { id: string; name: string };
  tasks: { id: string; name: string }[];
}

type Fixtures = {
  loginPage: LoginPage;
  header: HeaderComponent;
  boardPage: BoardPage;
  cardModal: CardModalPage;
  api: ApiClient;
  bootstrappedBoard: BootstrappedBoard;
  readyBoard: BootstrappedBoard;
  boardWithCard: BoardWithCardContext;
  openedCard: BoardWithCardContext;
  // DnD layouts (board pre-seeded via API, then opened in the browser, ready for interaction).
  boardWithThreeListsAndCards: BoardWithLayoutContext;
  twoBoardLayout: TwoBoardLayoutContext;
  cardWithThreeTasks: CardWithTasksContext;
};

export const test = base.extend<Fixtures>({
  // Page objects -------------------------------------------------------------
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },

  header: async ({ page }, use) => {
    await use(new HeaderComponent(page));
  },

  boardPage: async ({ page }, use) => {
    await use(new BoardPage(page));
  },

  cardModal: async ({ page }, use) => {
    await use(new CardModalPage(page));
  },

  api: async ({ request, context, baseURL }, use) => {
    await use(new ApiClient(request, context, baseURL!, process.env.E2E_API_BASE_URL));
  },

  // Pre-conditions -----------------------------------------------------------
  // API-creates a fresh project + board and seeds auth cookies. No UI navigation yet.
  // Teardown deletes the project, which cascades to its boards/lists/cards/comments —
  // so each test leaves the demo user's dashboard exactly as it found it.
  bootstrappedBoard: async ({ api }, use) => {
    const result = await api.bootstrapBoard({
      projectName: uniqueName(NamePrefixes.project),
      boardName: uniqueName(NamePrefixes.board),
    });
    try {
      await use(result);
    } finally {
      await api.deleteProject(result.token, result.projectId);
    }
  },

  // Board open in the browser, hydrated and ready for interaction.
  readyBoard: async ({ boardPage, bootstrappedBoard }, use) => {
    await boardPage.goto(bootstrappedBoard.boardId);
    await boardPage.expectReady();
    await use(bootstrappedBoard);
  },

  // Ready board with one list and one card already added via the UI.
  boardWithCard: async ({ boardPage, readyBoard }, use) => {
    await boardPage.addList(uniqueName(NamePrefixes.taskList));
    const cardName = uniqueName(NamePrefixes.sampleCard);
    await boardPage.addCard(cardName);
    await use({ boardId: readyBoard.boardId, cardName });
  },

  // Card modal open at /cards/<id>.
  openedCard: async ({ boardPage, cardModal, boardWithCard }, use) => {
    await boardPage.openCard(boardWithCard.cardName);
    await cardModal.expectOpen();
    await use(boardWithCard);
  },

  // ── DnD layouts ──────────────────────────────────────────────────────────
  // 3 lists × 2 cards each, seeded via API, board open and hydrated.
  boardWithThreeListsAndCards: async ({ api, boardPage }, use) => {
    const result = await api.bootstrapBoardWithLayout({
      projectName: uniqueName(NamePrefixes.project),
      boardName: uniqueName(NamePrefixes.board),
      layout: [
        { listName: NamePrefixes.todoListDnd, cardNames: [NamePrefixes.cardAlpha, NamePrefixes.cardBravo] },
        { listName: NamePrefixes.doingListDnd, cardNames: [NamePrefixes.cardCharlie, NamePrefixes.cardDelta] },
        { listName: NamePrefixes.doneListDnd, cardNames: [] },
      ],
    });
    try {
      await boardPage.goto(result.boardId);
      await boardPage.expectReady();
      await use(result);
    } finally {
      await api.deleteProject(result.token, result.projectId);
    }
  },

  // Two boards in one project: a card lives on board #1; tests move it to board #2.
  twoBoardLayout: async ({ api, boardPage }, use) => {
    const result = await api.bootstrapTwoBoardLayout({
      projectName: uniqueName(NamePrefixes.project),
      boardName: uniqueName(NamePrefixes.board),
      secondBoardName: uniqueName(NamePrefixes.secondBoard),
      firstListName: NamePrefixes.todoListDnd,
      secondListName: NamePrefixes.doneListDnd,
      cardName: uniqueName(NamePrefixes.cardAlpha),
    });
    try {
      await boardPage.goto(result.boardId);
      await boardPage.expectReady();
      await use(result);
    } finally {
      await api.deleteProject(result.token, result.projectId);
    }
  },

  // One card pre-seeded with three tasks, card modal opened.
  cardWithThreeTasks: async ({ api, boardPage, cardModal }, use) => {
    const result = await api.bootstrapCardWithTasks({
      projectName: uniqueName(NamePrefixes.project),
      boardName: uniqueName(NamePrefixes.board),
      listName: NamePrefixes.todoListDnd,
      cardName: uniqueName(NamePrefixes.cardAlpha),
      taskNames: [NamePrefixes.taskWriteSpec, NamePrefixes.taskAddTests, NamePrefixes.taskShipIt],
    });
    try {
      await boardPage.goto(result.boardId);
      await boardPage.expectReady();
      await boardPage.openCard(result.card.name);
      await cardModal.expectOpen();
      await use(result);
    } finally {
      await api.deleteProject(result.token, result.projectId);
    }
  },
});

export { expect } from '@playwright/test';
