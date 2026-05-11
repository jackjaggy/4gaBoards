import { expect, type Locator, type Page } from '@playwright/test';
import { escapeRegex } from '../utils/helpers';
import { Buttons, ListViewColumnHeaders, Placeholders } from '../utils/labels';
import { ConfirmDialogMessages } from '../utils/messages';
import { BasePage } from './base.page';

const LIST_WRITE_ENDPOINT = /\/api\/(boards\/[^/]+\/lists|lists\/[^/]+)(\?|$)/;
const CARD_WRITE_ENDPOINT = /\/api\/(lists\/[^/]+\/cards|cards\/[^/]+)(\?|$)/;
const WRITE_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'];

// Drives the /boards/<id> route — the kanban board surface.
// Encapsulates: list CRUD, card add/open, view toggle.
export class BoardPage extends BasePage {
  readonly addListButton: Locator;
  readonly addCardButton: Locator;
  readonly listNameInput: Locator;
  readonly cardAddInput: Locator;
  readonly editListButton: Locator;
  readonly switchToListViewButton: Locator;
  readonly switchToBoardViewButton: Locator;
  readonly listViewTable: Locator;
  readonly editListMenu: Locator;
  readonly deleteListMenuItem: Locator;
  readonly deleteListConfirmButton: Locator;
  readonly deleteListConfirmMessage: Locator;
  readonly deleteListCancelButton: Locator;

  constructor(page: Page) {
    super(page);
    this.addListButton = page.getByRole('button', { name: Buttons.addList });
    this.addCardButton = page.getByRole('button', { name: Buttons.addCard });
    this.listNameInput = page.getByPlaceholder(Placeholders.listName);
    this.cardAddInput = page.getByPlaceholder(Placeholders.cardNameAdd);
    this.editListButton = page.getByRole('button', { name: Buttons.editList, exact: true });
    this.switchToListViewButton = page.getByRole('button', { name: Buttons.switchToListView });
    this.switchToBoardViewButton = page.getByRole('button', { name: Buttons.switchToBoardView });
    this.listViewTable = page.getByRole('table');
    this.editListMenu = page.getByRole('dialog');
    this.deleteListMenuItem = this.editListMenu.getByRole('button', { name: Buttons.deleteList, exact: true });
    this.deleteListConfirmButton = this.editListMenu.getByRole('button', { name: Buttons.deleteListConfirm, exact: true });
    this.deleteListConfirmMessage = this.editListMenu.getByText(ConfirmDialogMessages.deleteList);
    this.deleteListCancelButton = this.editListMenu.getByRole('button', { name: Buttons.deleteListCancel, exact: true });
  }

  async goto(boardId: string): Promise<void> {
    await this.navigate(`/boards/${boardId}`);
  }

  async expectReady(): Promise<void> {
    // Add list trigger is the deterministic "board hydrated" signal — present whether or not lists exist.
    await expect(this.addListButton).toBeVisible();
  }

  // List CRUD ------------------------------------------------------------------

  async addList(name: string): Promise<void> {
    await this.addListButton.click();
    await this.listNameInput.fill(name);
    // The form's submit button shares its accessible name with the trigger; clicking the only visible
    // "Add list" while the form is open hits the submit. After submit the form stays open, so press
    // Escape to close it and avoid selector ambiguity for the next action.
    await this.addListButton.click();
    await this.page.keyboard.press('Escape');
    await expect(this.listNameByText(name)).toBeVisible();
  }

  async renameList(oldName: string, newName: string): Promise<void> {
    await this.listNameByText(oldName).click();
    await this.listNameInput.fill(newName);
    await this.listNameInput.press('Enter');
    await expect(this.listNameByText(newName)).toBeVisible();
    await expect(this.listNameByText(oldName)).toHaveCount(0);
  }

  async deleteList(name: string): Promise<void> {
    await this.editListButton.click();
    await this.deleteListMenuItem.click();
    await expect(this.deleteListConfirmMessage).toBeVisible();
    await this.deleteListConfirmButton.click();
    await expect(this.listNameByText(name)).toHaveCount(0);
  }

  // Walks to the delete-list confirmation and cancels it. Returns whether a write
  // request to the lists API fired during the entire flow.
  async cancelDeleteList(): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(LIST_WRITE_ENDPOINT);
    await this.editListButton.click();
    await this.deleteListMenuItem.click();
    await expect(this.deleteListConfirmMessage).toBeVisible();
    await this.deleteListCancelButton.click();
    // After Back, the user is returned to the edit menu, not the bare board.
    await expect(this.deleteListConfirmMessage).toHaveCount(0);
    await expect(this.deleteListMenuItem).toBeVisible();
    return (await writeRequest) !== null;
  }

  // Tries to submit the Add List form with the given (whitespace-only or empty) value.
  // Returns whether a create-list request fired.
  async attemptAddListWithInvalidName(value: string): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(LIST_WRITE_ENDPOINT);
    await this.addListButton.click();
    await expect(this.listNameInput).toBeVisible();
    if (value.length > 0) await this.listNameInput.fill(value);
    // Click submit — the same accessible name as the trigger; while the form is open
    // the only visible "Add list" button is the submit.
    await this.addListButton.click();
    // Whether the form closes (empty) or stays open (whitespace) is a UI detail we tolerate.
    // What matters is no creation request fired — assert it from the spec.
    return (await writeRequest) !== null;
  }

  // Same as above but for the Add Card form (assumes one visible "Add card" trigger).
  async attemptAddCardWithInvalidName(value: string): Promise<boolean> {
    const writeRequest = this.captureFirstWriteRequest(CARD_WRITE_ENDPOINT);
    await this.addCardButton.click();
    await expect(this.cardAddInput).toBeVisible();
    if (value.length > 0) await this.cardAddInput.fill(value);
    await this.addCardButton.click();
    return (await writeRequest) !== null;
  }

  async countLists(): Promise<number> {
    return this.page.getByRole('button', { name: /Collapse List .+ Edit List/ }).count();
  }

  async countCardsInFirstList(): Promise<number> {
    // Every card button has accessible name "<name> Edit Card".
    return this.page.getByRole('button', { name: / Edit Card$/ }).count();
  }

  private async captureFirstWriteRequest(matcher: RegExp): Promise<unknown> {
    return await this.page
      .waitForRequest(
        (req) => matcher.test(req.url()) && WRITE_METHODS.includes(req.method()),
        { timeout: 1000 },
      )
      .catch(() => null);
  }

  // Card add (open is a separate concern handled below) -----------------------

  async addCard(name: string): Promise<void> {
    // Assumes one visible "Add card" trigger (one list). Tests create a single list before calling.
    await this.addCardButton.click();
    await this.cardAddInput.fill(name);
    await this.addCardButton.click();
    await this.page.keyboard.press('Escape');
    await expect(this.cardButton(name)).toBeVisible();
  }

  async openCard(name: string): Promise<void> {
    await this.cardButton(name).click();
    await expect(this.page).toHaveURL(/\/cards\/\d+/);
  }

  // View toggle ----------------------------------------------------------------

  async switchToListView(): Promise<void> {
    await this.switchToListViewButton.click();
    await expect(this.listViewTable).toHaveCount(1);
  }

  async switchToBoardView(): Promise<void> {
    await this.switchToBoardViewButton.click();
    await expect(this.listViewTable).toHaveCount(0);
  }

  // Assertions -----------------------------------------------------------------

  async expectKanbanLayout(): Promise<void> {
    await expect(this.addListButton).toBeVisible();
    await expect(this.switchToListViewButton).toBeVisible();
    await expect(this.listViewTable).toHaveCount(0);
  }

  async expectListLayout(cardName: string): Promise<void> {
    await expect(this.listViewTable).toHaveCount(1);
    await expect(this.listViewTable.getByRole('columnheader', { name: ListViewColumnHeaders.name })).toBeVisible();
    await expect(this.listViewTable.getByRole('columnheader', { name: ListViewColumnHeaders.labels })).toBeVisible();
    await expect(this.listViewTable.getByRole('columnheader', { name: ListViewColumnHeaders.dueDate })).toBeVisible();
    await expect(this.listViewTable.getByText(cardName, { exact: true })).toBeVisible();
  }

  async expectListExists(name: string): Promise<void> {
    await expect(this.listHeaderButton(name)).toBeVisible();
  }

  async expectCardExists(name: string): Promise<void> {
    await expect(this.cardButton(name)).toBeVisible();
  }

  async expectCardAbsent(name: string): Promise<void> {
    await expect(this.cardButton(name)).toHaveCount(0);
  }

  // Dynamic locator builders --------------------------------------------------

  // The list name in a list header is rendered as plain text inside a clickable container.
  private listNameByText(name: string): Locator {
    return this.page.getByText(name, { exact: true });
  }

  // Each list's header is a composite button whose accessible name is "Collapse List <name> Edit List N cards".
  private listHeaderButton(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`Collapse List ${escapeRegex(name)} Edit List`) });
  }

  // Each card on the board is a button with accessible name "<name> Edit Card", with optional
  // metadata between the name and "Edit Card" (task progress badge "0/3", due-date chip, etc.).
  private cardButton(name: string): Locator {
    return this.page.getByRole('button', { name: new RegExp(`^${escapeRegex(name)}(\\s.*)? Edit Card$`) });
  }

  // ── Drag & drop ─────────────────────────────────────────────────────────
  // react-beautiful-dnd ignores synthetic mouse drag and HTML5 drag events. The reliable
  // path is its keyboard sensor: focus the drag handle → Space (lift) → ArrowKeys → Space (drop).
  // Each helper below issues that sequence and waits for the resulting DOM order to settle.

  private cardDragHandle(cardId: string): Locator {
    return this.page.locator(`[data-rbd-drag-handle-draggable-id="card:${cardId}"]`);
  }

  private listDragHandle(listId: string): Locator {
    return this.page.locator(`[data-rbd-drag-handle-draggable-id="list:${listId}"]`);
  }

  // Empty list droppable element — needed because rbd's keyboard sensor treats an empty
  // destination as "index 0", but only if the cursor reached it via arrow keys.
  private listDroppable(listId: string): Locator {
    return this.page.locator(`[data-rbd-droppable-id="list:${listId}"]`);
  }

  // Returns the card names in DOM order inside the given list droppable. Used to assert
  // both within-list reorder and cross-list move outcomes.
  async cardNamesInList(listId: string): Promise<string[]> {
    return this.listDroppable(listId)
      .locator('[data-rbd-draggable-id^="card:"]')
      .evaluateAll((nodes) => nodes.map((n) => (n.textContent || '').trim()));
  }

  async cardCountInList(listId: string): Promise<number> {
    return this.listDroppable(listId).locator('[data-rbd-draggable-id^="card:"]').count();
  }

  // Returns list ids in left-to-right DOM order.
  async listOrder(): Promise<string[]> {
    return this.page
      .locator('[data-rbd-droppable-id="board"] [data-rbd-draggable-id^="list:"]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-rbd-draggable-id')!.replace(/^list:/, '')));
  }

  // Press Space → ArrowKey×N → Space against an already-focused drag handle.
  //
  // Why we synchronise on rbd's announcement region rather than a fixed delay:
  // react-beautiful-dnd commits each keyboard step asynchronously — Space lifts the item,
  // each arrow updates the dragging React tree, and the next key has to land *after* that
  // render commits or the drag silently collapses into one move. rbd writes a fresh aria-live
  // announcement on every commit, so observing that text change is the deterministic signal
  // that the previous step has settled and it's safe to send the next key.
  private async pressDragSequence(arrowKey: 'ArrowRight' | 'ArrowLeft' | 'ArrowDown' | 'ArrowUp', steps: number): Promise<void> {
    const ctxId = await this.focusedDragContextId();
    await this.pressAndWaitForAnnouncement(ctxId, 'Space');
    for (let i = 0; i < steps; i += 1) {
      await this.pressAndWaitForAnnouncement(ctxId, arrowKey);
    }
    // Final Space (drop) doesn't need an announcement wait — assertions in the spec will
    // poll the resulting DOM order until it matches.
    await this.page.keyboard.press('Space');
  }

  private async focusedDragContextId(): Promise<string> {
    const ctx = await this.page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      return el?.getAttribute('data-rbd-drag-handle-context-id') ?? null;
    });
    if (!ctx) throw new Error('No rbd drag handle is focused — call focus() on the handle first');
    return ctx;
  }

  // Send a key and wait for the matching rbd announcement region's textContent to change.
  // Returns once the announcement reflects the new state (lift / move / drop announcement).
  private async pressAndWaitForAnnouncement(ctxId: string, key: string): Promise<void> {
    const announcementId = `rbd-announcement-${ctxId}`;
    const previous = await this.page.evaluate((id) => document.getElementById(id)?.textContent ?? '', announcementId);
    await this.page.keyboard.press(key);
    await this.page.waitForFunction(
      ({ id, prev }) => (document.getElementById(id)?.textContent ?? '') !== prev,
      { id: announcementId, prev: previous },
    );
  }

  // Drag a card horizontally by `steps` lists (positive = right). Uses the keyboard sensor.
  async dragCardHorizontally(cardId: string, steps: number): Promise<void> {
    const handle = this.cardDragHandle(cardId);
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    await this.pressDragSequence(steps >= 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(steps));
  }

  // Drag a card vertically by `steps` positions (positive = down).
  async dragCardVertically(cardId: string, steps: number): Promise<void> {
    const handle = this.cardDragHandle(cardId);
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    await this.pressDragSequence(steps >= 0 ? 'ArrowDown' : 'ArrowUp', Math.abs(steps));
  }

  // Drag a list horizontally by `steps` positions (positive = right).
  async dragListHorizontally(listId: string, steps: number): Promise<void> {
    const handle = this.listDragHandle(listId);
    await handle.scrollIntoViewIfNeeded();
    await handle.focus();
    await this.pressDragSequence(steps >= 0 ? 'ArrowRight' : 'ArrowLeft', Math.abs(steps));
  }

  // ── Card actions popup → Move (cross-board) ─────────────────────────────
  // The Move popup is a per-card action; not a DnD operation. It uses CardMoveStep, which
  // composes three custom Dropdown components (not native <select>). Each Dropdown renders
  // an <input name="projectId|boardId|listId"> as its trigger and portals options out as
  // <div data-prevent-card-switch> rows.
  async moveCardToBoard(cardName: string, targetBoardName: string, targetListName: string): Promise<void> {
    await this.cardButton(cardName).hover();
    await this.cardEditButtonNear(cardName).click();
    await this.page.getByRole('button', { name: Buttons.moveCard, exact: true }).click();

    // Open the Board dropdown, choose the target board.
    await this.page.locator('input[name="boardId"]').click();
    await this.dropdownOption(targetBoardName).click();

    // The destination board's lists are lazy-loaded after selection; the List dropdown only
    // appears once that fetch resolves. Waiting on the input itself avoids a race.
    const listInput = this.page.locator('input[name="listId"]');
    await expect(listInput).toBeVisible();
    await listInput.click();
    await this.dropdownOption(targetListName).click();

    await this.page.getByRole('button', { name: Buttons.moveSubmit, exact: true }).click();
  }

  // Dropdown options have no role; they're <div data-prevent-card-switch> elements with
  // the option's name as text content. The attribute is unique to dropdown items, so it's
  // a stable scope even when other parts of the page contain the same text.
  private dropdownOption(name: string): Locator {
    return this.page.locator('[data-prevent-card-switch]').filter({ hasText: name }).first();
  }

  // The "Edit Card" icon button sits inside the same card wrapper. Match by accessible
  // name ("Edit Card") scoped to the card's tile.
  private cardEditButtonNear(cardName: string): Locator {
    return this.page
      .locator('[data-rbd-draggable-id^="card:"]', { hasText: cardName })
      .getByRole('button', { name: Buttons.editCard });
  }
}
