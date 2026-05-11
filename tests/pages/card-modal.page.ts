import { expect, type Locator, type Page, type WebSocket } from '@playwright/test';
import { escapeRegex } from '../utils/helpers';
import { Buttons, Placeholders } from '../utils/labels';
import { ConfirmDialogMessages } from '../utils/messages';
import { BasePage } from './base.page';

const COMMENT_WRITE_ENDPOINT = /\/api\/(cards\/[^/]+\/comments|comments\/[^/]+)(\?|$)/;
// Match card-itself writes (rename/delete) — must end at the id, not /comments, /labels, etc.
const CARD_SELF_WRITE_ENDPOINT = /\/api\/cards\/[^/]+(\?|$)/;
const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

// Drives the /cards/<id> route — the open card modal.
// Encapsulates: card rename + delete, and full comments lifecycle.
export class CardModalPage extends BasePage {
  readonly cardRenameInput: Locator;
  readonly addCommentTrigger: Locator;
  readonly commentNewInput: Locator;
  readonly commentEditInput: Locator;
  readonly saveButton: Locator;
  readonly editCommentButton: Locator;
  readonly deleteCommentButton: Locator;
  readonly deleteCardButton: Locator;
  readonly confirmDialog: Locator;
  readonly deleteCardConfirmMessage: Locator;
  readonly deleteCardConfirmButton: Locator;
  readonly deleteCardCancelButton: Locator;
  readonly deleteCommentConfirmMessage: Locator;
  readonly deleteCommentConfirmButton: Locator;
  readonly deleteCommentCancelButton: Locator;
  readonly cardTitle: Locator;
  // The Socket.IO connection. Captured via page.on('websocket') the first time the SPA opens it.
  // Task position updates flow over this socket (api/tasks.js → sails.io socket.patch), so HTTP-level
  // request waits don't see them — we observe ack frames here instead.
  private webSocket: WebSocket | null = null;

  constructor(page: Page) {
    super(page);
    // Listener registered eagerly in the constructor. Fixture order is:
    //   cardModal: new CardModalPage(page)  →  boardWithThreeTasks: boardPage.goto(...)
    // i.e. this listener is in place before the SPA boots and opens its Socket.IO connection,
    // so we capture the very first websocket. Subsequent reloads replace it; we always keep
    // the latest one.
    page.on('websocket', (ws) => {
      this.webSocket = ws;
    });
    this.cardTitle = page.getByTestId('card-modal-title');
    this.cardRenameInput = page.getByPlaceholder(Placeholders.cardNameRename, { exact: true });

    // Two buttons share the accessible name "Add comment" inside the modal: a header icon and the body
    // trigger that opens the editor. The body trigger is the second one in DOM order.
    this.addCommentTrigger = page.getByRole('button', { name: Buttons.addComment }).last();
    this.commentNewInput = page.getByPlaceholder(Placeholders.commentNew);
    this.commentEditInput = page.getByPlaceholder(Placeholders.commentEdit);
    this.saveButton = page.getByRole('button', { name: Buttons.save, exact: true });
    this.editCommentButton = page.getByRole('button', { name: Buttons.editComment });
    this.deleteCommentButton = page.getByRole('button', { name: Buttons.deleteComment });
    this.deleteCardButton = page.getByRole('button', { name: Buttons.deleteCard, exact: true });

    this.confirmDialog = page.getByRole('dialog');
    this.deleteCardConfirmMessage = this.confirmDialog.getByText(ConfirmDialogMessages.deleteCard);
    this.deleteCardConfirmButton = this.confirmDialog.getByRole('button', { name: Buttons.deleteCardConfirm, exact: true });
    this.deleteCardCancelButton = this.confirmDialog.getByRole('button', { name: Buttons.deleteCardCancel, exact: true });
    this.deleteCommentConfirmMessage = this.confirmDialog.getByText(ConfirmDialogMessages.deleteComment);
    this.deleteCommentConfirmButton = this.confirmDialog.getByRole('button', { name: Buttons.deleteCommentConfirm, exact: true });
    this.deleteCommentCancelButton = this.confirmDialog.getByRole('button', { name: Buttons.deleteCommentCancel, exact: true });
  }

  async expectOpen(): Promise<void> {
    await expect(this.page).toHaveURL(/\/cards\/\d+/);
  }

  // Card rename / delete -------------------------------------------------------

  // currentName is no longer used to locate the element — kept for call-site readability and
  // so future callers can pass it through. The selector is anchored on data-testid which is
  // unambiguous (one card-modal title per modal).
  async renameCard(_currentName: string, newName: string): Promise<void> {
    await this.cardTitle.click();
    await this.cardRenameInput.fill(newName);
    await this.cardRenameInput.press('Enter');
  }

  async expectCardTitleInTab(name: string): Promise<void> {
    await expect(this.page).toHaveTitle(new RegExp(`^${escapeRegex(name)} - `));
  }

  async deleteCard(): Promise<void> {
    await this.deleteCardButton.click();
    await expect(this.deleteCardConfirmMessage).toBeVisible();
    await this.deleteCardConfirmButton.click();
    await expect(this.page).toHaveURL(/\/boards\/\d+/);
  }

  // Comments -------------------------------------------------------------------

  async addComment(text: string): Promise<void> {
    await this.addCommentTrigger.click();
    await this.commentNewInput.fill(text);
    await this.saveButton.click();
    await expect(this.commentTextRendered(text)).toBeVisible();
  }

  async editLastComment(newText: string): Promise<void> {
    await this.editCommentButton.click();
    await this.commentEditInput.fill(newText);
    await this.saveButton.click();
  }

  async deleteLastComment(): Promise<void> {
    await this.deleteCommentButton.click();
    await expect(this.deleteCommentConfirmMessage).toBeVisible();
    await this.deleteCommentConfirmButton.click();
  }

  async expectCommentVisible(text: string): Promise<void> {
    await expect(this.commentTextRendered(text)).toBeVisible();
  }

  async expectCommentAbsent(text: string): Promise<void> {
    await expect(this.commentTextRendered(text)).toHaveCount(0);
  }

  // Tries to save a comment with the given (empty or whitespace-only) value.
  // Returns whether a comment-write request was observed.
  async attemptAddCommentWithInvalidText(value: string): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(COMMENT_WRITE_ENDPOINT);
    await this.addCommentTrigger.click();
    await expect(this.commentNewInput).toBeVisible();
    if (value.length > 0) await this.commentNewInput.fill(value);
    await this.saveButton.click();
    return (await writeRequest) !== null;
  }

  // Cancels the Delete Card confirmation; asserts the card stays open. Returns whether
  // any card-write request fired (we expect none).
  async cancelDeleteCard(): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(CARD_SELF_WRITE_ENDPOINT);
    await this.deleteCardButton.click();
    await expect(this.deleteCardConfirmMessage).toBeVisible();
    await this.deleteCardCancelButton.click();
    await expect(this.deleteCardConfirmMessage).toHaveCount(0);
    await expect(this.page).toHaveURL(/\/cards\/\d+/);
    return (await writeRequest) !== null;
  }

  // Cancels the Delete Comment confirmation; asserts the dialog dismisses.
  async cancelDeleteLastComment(): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(COMMENT_WRITE_ENDPOINT);
    await this.deleteCommentButton.click();
    await expect(this.deleteCommentConfirmMessage).toBeVisible();
    await this.deleteCommentCancelButton.click();
    await expect(this.deleteCommentConfirmMessage).toHaveCount(0);
    return (await writeRequest) !== null;
  }

  private commentTextRendered(text: string): Locator {
    return this.page.getByText(text, { exact: true });
  }

  private async captureFirstWriteRequest(matcher: RegExp): Promise<unknown> {
    return await this.page
      .waitForRequest(
        (req) => matcher.test(req.url()) && WRITE_METHODS.includes(req.method()),
        { timeout: 1000 },
      )
      .catch(() => null);
  }

  // ── Task drag & drop ────────────────────────────────────────────────────
  // Tasks are wrapped in <Draggable draggableId={id}> — note the bare id (no "task:" prefix).
  // The drag handle is the row wrapper itself. Same keyboard-sensor flow as cards/lists.
  private taskDragHandle(taskId: string): Locator {
    return this.page.locator(`[data-rbd-drag-handle-draggable-id="${taskId}"]`);
  }

  // Returns task names in DOM order inside the modal's task list (droppable id "tasks").
  async taskNamesInOrder(): Promise<string[]> {
    return this.page
      .locator('[data-rbd-droppable-id="tasks"] [data-rbd-draggable-id]')
      .evaluateAll((nodes) => nodes.map((n) => (n.textContent || '').trim()));
  }

  async dragTaskVertically(taskId: string, steps: number): Promise<void> {
    const handle = this.taskDragHandle(taskId);
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    const ctxId = await this.focusedDragContextId();
    const arrow = steps >= 0 ? 'ArrowDown' : 'ArrowUp';
    await this.pressAndWaitForAnnouncement(ctxId, 'Space');
    for (let i = 0; i < Math.abs(steps); i += 1) {
      await this.pressAndWaitForAnnouncement(ctxId, arrow);
    }
    // Begin watching for the server ack BEFORE issuing the drop — otherwise on a fast network
    // the response frame can arrive in the microtask gap between page.keyboard.press and the
    // call to waitForEvent, and we'd hang waiting for a frame that already came and went.
    const ackPromise = this.waitForTaskPatchAck(taskId);
    await this.page.keyboard.press('Space');
    await ackPromise;
  }

  // Wait until the Socket.IO peer acknowledges a PATCH for the given task — i.e. the new
  // position has been committed server-side. Without this wait, callers that follow the drag
  // with a destructive action (notably page.reload) can race the in-flight commit and observe
  // the pre-drag order on the next render, producing an intermittent failure.
  //
  // Frame shapes (observed via live MCP probing):
  //   sent     `4<reqId>["patch",{...,"url":"/api/tasks/<taskId>","data":{"position":N}}]`
  //   received `4<reqId>[null,{...,"statusCode":200,"body":{"item":{"id":"<taskId>","position":N,...}}}]`
  // The ack uniquely contains both the taskId and a position field, so that predicate is enough
  // to disambiguate from unrelated broadcasts that mention the same id (e.g. activity feed).
  private async waitForTaskPatchAck(taskId: string): Promise<void> {
    if (!this.webSocket) {
      throw new Error('CardModalPage.waitForTaskPatchAck: no WebSocket captured — did the page open one?');
    }
    await this.webSocket.waitForEvent('framereceived', {
      predicate: (frame) => {
        const payload = typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');
        return payload.includes(`"id":"${taskId}"`) && payload.includes('"position":');
      },
      timeout: 10_000,
    });
  }

  // Tasks live in their own DragDropContext (separate from the board). The ctxId of the
  // focused handle tells us which rbd-announcement-N region to observe. Same waiting strategy
  // as BoardPage.pressAndWaitForAnnouncement — replaces hardcoded waitForTimeout(60).
  private async focusedDragContextId(): Promise<string> {
    const ctx = await this.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('data-rbd-drag-handle-context-id') ?? null;
    });
    if (!ctx) throw new Error('No rbd drag handle is focused — call focus() on the handle first');
    return ctx;
  }

  private async pressAndWaitForAnnouncement(ctxId: string, key: string): Promise<void> {
    const announcementId = `rbd-announcement-${ctxId}`;
    const previous = await this.page.evaluate((id) => document.getElementById(id)?.textContent ?? '', announcementId);
    await this.page.keyboard.press(key);
    await this.page.waitForFunction(
      ({ id, prev }) => (document.getElementById(id)?.textContent ?? '') !== prev,
      { id: announcementId, prev: previous },
    );
  }
}
