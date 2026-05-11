import { expect, test } from '../../fixtures/test.fixture';

// Trello-clone DnD lives or dies on these flows. The app uses react-beautiful-dnd, which ignores
// HTML5 drag events and Playwright's default dragTo — so the helpers drive rbd's keyboard sensor
// (Space → arrows → Space). Cross-board moves are a popup action, not a DnD operation.
test.describe('Card move', () => {
  test.describe('Within a single board (drag and drop)', () => {
    test('reorders a card within its list (Alpha → after Bravo)', async ({ boardPage, boardWithThreeListsAndCards }) => {
      const ctx = boardWithThreeListsAndCards;
      const todoListId = ctx.lists[0].id;
      const alphaId = ctx.lists[0].cards[0].id;
      const [alphaName, bravoName] = ctx.lists[0].cards.map((c) => c.name);

      expect(await boardPage.cardNamesInList(todoListId)).toEqual([alphaName, bravoName]);

      await boardPage.dragCardVertically(alphaId, 1);

      await expect.poll(() => boardPage.cardNamesInList(todoListId)).toEqual([bravoName, alphaName]);
    });

    test('moves a card from one list to the next (Alpha: To Do → Doing)', async ({ boardPage, boardWithThreeListsAndCards }) => {
      const ctx = boardWithThreeListsAndCards;
      const [todo, doing] = ctx.lists;
      const alphaId = todo.cards[0].id;
      const alphaName = todo.cards[0].name;

      expect(await boardPage.cardNamesInList(todo.id)).toContain(alphaName);

      await boardPage.dragCardHorizontally(alphaId, 1);

      // Card should leave the source list and land at the top of the destination list.
      await expect.poll(() => boardPage.cardCountInList(todo.id)).toBe(1);
      await expect.poll(() => boardPage.cardNamesInList(doing.id)).toEqual([alphaName, ...doing.cards.map((c) => c.name)]);
    });

    // Two consecutive drags — the realistic user flow for moving a card more than one list
    // away. (rbd's keyboard sensor commits the drop after each Space, so a single multi-arrow
    // gesture isn't equivalent to a continuous mouse drag across multiple droppables.)
    test('moves a card across two lists via two consecutive drags (Alpha: To Do → Doing → Done)', async ({ boardPage, boardWithThreeListsAndCards }) => {
      const ctx = boardWithThreeListsAndCards;
      const [todo, doing, done] = ctx.lists;
      const alphaId = todo.cards[0].id;
      const alphaName = todo.cards[0].name;

      await boardPage.dragCardHorizontally(alphaId, 1);
      await expect.poll(() => boardPage.cardNamesInList(doing.id)).toContain(alphaName);

      await boardPage.dragCardHorizontally(alphaId, 1);
      await expect.poll(() => boardPage.cardCountInList(todo.id)).toBe(1);
      await expect.poll(() => boardPage.cardCountInList(doing.id)).toBe(2);
      await expect.poll(() => boardPage.cardNamesInList(done.id)).toEqual([alphaName]);
    });

    // After a reload, the persisted position must hold — proves the move hit the server, not just
    // local Redux-ORM state. Without this assertion an optimistic-update bug would pass silently.
    test('move persists across a full page reload', async ({ page, boardPage, boardWithThreeListsAndCards }) => {
      const ctx = boardWithThreeListsAndCards;
      const [todo, doing] = ctx.lists;
      const alphaId = todo.cards[0].id;
      const alphaName = todo.cards[0].name;

      await boardPage.dragCardHorizontally(alphaId, 1);
      await expect.poll(() => boardPage.cardNamesInList(doing.id)).toContain(alphaName);

      await page.reload();
      await boardPage.expectReady();

      await expect.poll(() => boardPage.cardNamesInList(doing.id)).toEqual([alphaName, ...doing.cards.map((c) => c.name)]);
      await expect.poll(() => boardPage.cardNamesInList(todo.id)).not.toContain(alphaName);
    });
  });

  // 4ga Boards has no DnD across boards (boards live on different routes); the user-visible
  // equivalent is the card actions popup → Move Card → choose project/board/list → Move.
  test.describe('Across boards (popup action)', () => {
    test('moves a card to another board via the Move Card popup', async ({ page, boardPage, twoBoardLayout }) => {
      const { card, list, secondBoard, secondBoardList } = twoBoardLayout;

      expect(await boardPage.cardNamesInList(list.id)).toEqual([card.name]);

      await boardPage.moveCardToBoard(card.name, secondBoard.name, secondBoardList.name);

      // Source list empties on the current board.
      await expect.poll(() => boardPage.cardCountInList(list.id)).toBe(0);

      // Switch boards and confirm the card landed on the destination list.
      await boardPage.goto(secondBoard.id);
      await boardPage.expectReady();
      await expect.poll(() => boardPage.cardNamesInList(secondBoardList.id)).toEqual([card.name]);
      await expect(page).toHaveURL(new RegExp(`/boards/${secondBoard.id}$`));
    });
  });
});
