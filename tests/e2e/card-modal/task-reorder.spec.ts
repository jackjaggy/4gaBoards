import { expect, test } from '../../fixtures/test.fixture';

// Tasks (subtasks) inside a card are also rbd Draggables, with their own DragDropContext
// scoped to the card modal. The keyboard-sensor flow is identical: Space → arrows → Space.
test.describe('Task reorder inside a card (drag and drop)', () => {
  test('drags the first task one slot down', async ({ cardModal, cardWithThreeTasks }) => {
    const [first, second, third] = cardWithThreeTasks.tasks;

    expect(await cardModal.taskNamesInOrder()).toEqual([first.name, second.name, third.name]);

    await cardModal.dragTaskVertically(first.id, 1);

    await expect.poll(() => cardModal.taskNamesInOrder()).toEqual([second.name, first.name, third.name]);
  });

  test('drags the first task to the bottom in one motion', async ({ cardModal, cardWithThreeTasks }) => {
    const [first, second, third] = cardWithThreeTasks.tasks;

    await cardModal.dragTaskVertically(first.id, 2);

    await expect.poll(() => cardModal.taskNamesInOrder()).toEqual([second.name, third.name, first.name]);
  });

  test('drags the last task to the top in one motion', async ({ cardModal, cardWithThreeTasks }) => {
    const [first, second, third] = cardWithThreeTasks.tasks;

    await cardModal.dragTaskVertically(third.id, -2);

    await expect.poll(() => cardModal.taskNamesInOrder()).toEqual([third.name, first.name, second.name]);
  });

  // Persistence check: task position is server-side state. A reorder that never reached the
  // server would re-hydrate in the original order on reload.
  test('task reorder persists across a full page reload', async ({ page, boardPage, cardModal, cardWithThreeTasks }) => {
    const [first, second, third] = cardWithThreeTasks.tasks;

    await cardModal.dragTaskVertically(first.id, 2);
    await expect.poll(() => cardModal.taskNamesInOrder()).toEqual([second.name, third.name, first.name]);

    await page.reload();
    await boardPage.expectReady();
    await cardModal.expectOpen();

    await expect.poll(() => cardModal.taskNamesInOrder()).toEqual([second.name, third.name, first.name]);
  });
});
