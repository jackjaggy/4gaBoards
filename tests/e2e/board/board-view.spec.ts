import { expect, test } from '../../fixtures/test.fixture';

test.describe('Board view', () => {
  test.describe('Toggle', () => {
    test('default view is Kanban', async ({ boardPage, boardWithCard }) => {
      void boardWithCard;
      await boardPage.expectKanbanLayout();
    });

    test('switching to List View renders cards in a tabular layout', async ({ boardPage, boardWithCard }) => {
      await boardPage.switchToListView();
      await boardPage.expectListLayout(boardWithCard.cardName);
    });

    test('switching back to Board View restores the Kanban layout', async ({ boardPage, boardWithCard }) => {
      void boardWithCard;
      await boardPage.switchToListView();
      await boardPage.switchToBoardView();
      await boardPage.expectKanbanLayout();
    });
  });

  // Documented behaviour: the view toggle is session-scoped and resets to the default
  // Kanban layout on full page reload. Pinning this down prevents an accidental future
  // change from going unnoticed.
  test.describe('Persistence on reload', () => {
    test('reload resets List View back to the default Kanban layout', async ({ page, boardPage, boardWithCard }) => {
      void boardWithCard;
      await boardPage.switchToListView();
      await expect(boardPage.listViewTable).toHaveCount(1);

      await page.reload();
      await boardPage.expectReady();

      await boardPage.expectKanbanLayout();
    });
  });
});
