import { expect, test } from '../../fixtures/test.fixture';

test.describe('List reorder (drag and drop)', () => {
  test('drags the leftmost list one position to the right', async ({ boardPage, boardWithThreeListsAndCards }) => {
    const ctx = boardWithThreeListsAndCards;
    const [todo, doing, done] = ctx.lists;

    expect(await boardPage.listOrder()).toEqual([todo.id, doing.id, done.id]);

    await boardPage.dragListHorizontally(todo.id, 1);

    await expect.poll(() => boardPage.listOrder()).toEqual([doing.id, todo.id, done.id]);
  });

  test('drags a list two positions to the right (To Do → end)', async ({ boardPage, boardWithThreeListsAndCards }) => {
    const ctx = boardWithThreeListsAndCards;
    const [todo, doing, done] = ctx.lists;

    await boardPage.dragListHorizontally(todo.id, 2);

    await expect.poll(() => boardPage.listOrder()).toEqual([doing.id, done.id, todo.id]);
  });

  test('drags a list one position to the left (Done → middle)', async ({ boardPage, boardWithThreeListsAndCards }) => {
    const ctx = boardWithThreeListsAndCards;
    const [todo, doing, done] = ctx.lists;

    await boardPage.dragListHorizontally(done.id, -1);

    await expect.poll(() => boardPage.listOrder()).toEqual([todo.id, done.id, doing.id]);
  });

  // Persistence check: a list move that only updates Redux-ORM but never reaches the server
  // would pass the in-memory order assertion above, then revert on reload.
  test('list reorder persists across a full page reload', async ({ page, boardPage, boardWithThreeListsAndCards }) => {
    const ctx = boardWithThreeListsAndCards;
    const [todo, doing, done] = ctx.lists;

    await boardPage.dragListHorizontally(todo.id, 2);
    await expect.poll(() => boardPage.listOrder()).toEqual([doing.id, done.id, todo.id]);

    await page.reload();
    await boardPage.expectReady();

    await expect.poll(() => boardPage.listOrder()).toEqual([doing.id, done.id, todo.id]);
  });
});
