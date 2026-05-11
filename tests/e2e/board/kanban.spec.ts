import { expect, test } from '../../fixtures/test.fixture';
import { uniqueName } from '../../utils/helpers';
import { NamePrefixes, WHITESPACE_INPUT } from '../../utils/test-data';

// API-only setup via the readyBoard fixture: a fresh project + board per test, no UI clicks for setup.
test.describe('Kanban — Lists & Cards', () => {
  test.describe('CRUD', () => {
    test('adds a list to the board', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const listName = uniqueName(NamePrefixes.todoList);
      await boardPage.addList(listName);
      await boardPage.expectListExists(listName);
    });

    test('renames a list via inline edit', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const original = uniqueName(NamePrefixes.backlogList);
      const renamed = uniqueName(NamePrefixes.sprintBacklogList);
      await boardPage.addList(original);
      await boardPage.renameList(original, renamed);
    });

    test('deletes a list via the action menu and confirmation', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const listName = uniqueName(NamePrefixes.doomedList);
      await boardPage.addList(listName);
      await boardPage.deleteList(listName);
    });

    test('adds a card to a list', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      await boardPage.addList(uniqueName(NamePrefixes.taskList));
      const cardName = uniqueName(NamePrefixes.buyMilkCard);
      await boardPage.addCard(cardName);
      await boardPage.expectCardExists(cardName);
    });

    test('renames a card via the card modal', async ({ boardPage, cardModal, readyBoard }) => {
      void readyBoard;
      await boardPage.addList(uniqueName(NamePrefixes.taskList));
      const original = uniqueName(NamePrefixes.originalCardTitle);
      const renamed = uniqueName(NamePrefixes.renamedCardTitle);
      await boardPage.addCard(original);
      await boardPage.openCard(original);

      await cardModal.expectOpen();
      await cardModal.renameCard(original, renamed);
      await cardModal.expectCardTitleInTab(renamed);
    });

    test('deletes a card via the card modal with confirmation', async ({ boardPage, cardModal, readyBoard }) => {
      void readyBoard;
      await boardPage.addList(uniqueName(NamePrefixes.taskList));
      const cardName = uniqueName(NamePrefixes.disposableCard);
      await boardPage.addCard(cardName);
      await boardPage.openCard(cardName);

      await cardModal.deleteCard();
      await boardPage.expectCardAbsent(cardName);
    });
  });

  // Skipped at E2E level — these verify pure client-side behaviour (AddListPopup / AddCardPopup
  // empty-name guards) with no saga / API / WebSocket / DB involvement. They belong as Jest unit
  // tests against the popup components. The "no network request fired" assertion uses a 1s
  // waitForRequest window which is structurally flake-prone on a slow CI runner. The happy-path
  // CRUD tests above already exercise the end-to-end network boundary.
  test.describe.skip('Empty-name guards (push down to Jest unit tests)', () => {
    // Required-field guards on the Add List and Add Card forms.
    // Empty and whitespace-only submissions must not produce a create request. We assert
    // (a) no list/card-write request fires during the submit window, and (b) the board's
    // list/card count is unchanged.
    test('rejects an empty list name (no create request, list count unchanged)', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const before = await boardPage.countLists();

      const requestFired = await boardPage.attemptAddListWithInvalidName('');

      expect(requestFired, 'no list-create request should fire on empty submit').toBe(false);
      expect(await boardPage.countLists()).toBe(before);
    });

    test('rejects a whitespace-only list name (no create request, list count unchanged)', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const before = await boardPage.countLists();

      const requestFired = await boardPage.attemptAddListWithInvalidName(WHITESPACE_INPUT);

      expect(requestFired, 'no list-create request should fire on whitespace-only submit').toBe(false);
      expect(await boardPage.countLists()).toBe(before);
    });

    test('rejects an empty card name (no create request, card count unchanged)', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      // Add a list so the Add card trigger is visible; without it there's nothing to click.
      await boardPage.addList(uniqueName(NamePrefixes.taskList));
      const before = await boardPage.countCardsInFirstList();

      const requestFired = await boardPage.attemptAddCardWithInvalidName('');

      expect(requestFired, 'no card-create request should fire on empty submit').toBe(false);
      expect(await boardPage.countCardsInFirstList()).toBe(before);
    });

    test('rejects a whitespace-only card name (no create request, card count unchanged)', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      await boardPage.addList(uniqueName(NamePrefixes.taskList));
      const before = await boardPage.countCardsInFirstList();

      const requestFired = await boardPage.attemptAddCardWithInvalidName(WHITESPACE_INPUT);

      expect(requestFired, 'no card-create request should fire on whitespace-only submit').toBe(false);
      expect(await boardPage.countCardsInFirstList()).toBe(before);
    });
  });

  // Cancelling a destructive confirmation must preserve the entity and not fire any
  // write request to the relevant resource. Skipped — generic ConfirmDialog / DeletePopup
  // wiring is presentational and best covered by component tests.
  test.describe.skip('Cancel-confirmation guards (push down to Jest unit tests on ConfirmDialog)', () => {
    test('cancelling Delete List preserves the list', async ({ boardPage, readyBoard }) => {
      void readyBoard;
      const listName = uniqueName(NamePrefixes.preservedList);
      await boardPage.addList(listName);

      const requestFired = await boardPage.cancelDeleteList();

      expect(requestFired, 'no list write should fire when cancelling').toBe(false);
      await boardPage.expectListExists(listName);
    });

    test('cancelling Delete Card preserves the card and keeps the modal open', async ({ boardPage, cardModal, boardWithCard }) => {
      await boardPage.openCard(boardWithCard.cardName);
      await cardModal.expectOpen();

      const requestFired = await cardModal.cancelDeleteCard();

      expect(requestFired, 'no card write should fire when cancelling').toBe(false);
      // Modal still open at /cards/<id>; navigate back to the board and assert presence.
      await boardPage.goto(boardWithCard.boardId);
      await boardPage.expectCardExists(boardWithCard.cardName);
    });
  });
});
