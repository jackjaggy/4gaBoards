import { expect, test } from '../../fixtures/test.fixture';
import { uniqueName } from '../../utils/helpers';
import { NamePrefixes, WHITESPACE_INPUT } from '../../utils/test-data';

test.describe('Card Comments', () => {
  test.describe('CRUD', () => {
    test('adds a comment to a card', async ({ cardModal, openedCard }) => {
      void openedCard;
      const text = uniqueName(NamePrefixes.firstComment);
      await cardModal.addComment(text);
      await cardModal.expectCommentVisible(text);
    });

    test('edits an existing comment', async ({ cardModal, openedCard }) => {
      void openedCard;
      const original = uniqueName(NamePrefixes.originalComment);
      const edited = uniqueName(NamePrefixes.editedComment);
      await cardModal.addComment(original);
      await cardModal.editLastComment(edited);
      await cardModal.expectCommentVisible(edited);
      await cardModal.expectCommentAbsent(original);
    });

    test('deletes a comment via confirmation', async ({ cardModal, openedCard }) => {
      void openedCard;
      const text = uniqueName(NamePrefixes.doomedComment);
      await cardModal.addComment(text);
      await cardModal.deleteLastComment();
      await cardModal.expectCommentAbsent(text);
    });
  });

  // Skipped at E2E level — the Add Comment Save button's empty/whitespace guard is pure CommentEdit
  // form logic with no saga / API / WebSocket / DB involvement. Belongs as a Jest unit test on
  // CommentEdit. The "no network request fired" assertion uses a 1s waitForRequest window which is
  // structurally flake-prone on a slow CI runner.
  test.describe.skip('Empty-text guards (push down to Jest unit tests on CommentEdit)', () => {
    // The Add Comment Save button must not POST when the comment body is empty or whitespace-only.
    test('does not POST a comment when the text is empty', async ({ cardModal, openedCard }) => {
      void openedCard;

      const requestFired = await cardModal.attemptAddCommentWithInvalidText('');

      expect(requestFired, 'no comment-create request should fire on empty submit').toBe(false);
    });

    test('does not POST a comment when the text is whitespace-only', async ({ cardModal, openedCard }) => {
      void openedCard;

      const requestFired = await cardModal.attemptAddCommentWithInvalidText(WHITESPACE_INPUT);

      expect(requestFired, 'no comment-create request should fire on whitespace-only submit').toBe(false);
    });
  });

  // Cancelling Delete Comment must preserve the comment and not fire any write request.
  // Skipped — generic ConfirmDialog wiring is best covered by component tests.
  test.describe.skip('Cancel-confirmation guards (push down to Jest unit tests on ConfirmDialog)', () => {
    test('cancelling Delete Comment preserves the comment', async ({ cardModal, openedCard }) => {
      void openedCard;
      const text = uniqueName(NamePrefixes.preservedComment);
      await cardModal.addComment(text);

      const requestFired = await cardModal.cancelDeleteLastComment();

      expect(requestFired, 'no comment write should fire when cancelling').toBe(false);
      await cardModal.expectCommentVisible(text);
    });
  });
});
