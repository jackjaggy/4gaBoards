// Visible UI labels — accessible button names, headings, placeholders, column headers.
// Page objects use these to build locators; tests import them where direct assertions need a label.

export const Headings = {
  login: 'Log in',
} as const;

export const Buttons = {
  logIn: 'Log in',
  logOut: 'Log Out',
  addProject: 'Add Project',
  addBoard: 'Add Board',
  addList: 'Add list',
  addCard: 'Add card',
  addComment: 'Add comment',
  save: 'Save',
  editList: 'Edit List',
  deleteList: 'Delete List',
  deleteListConfirm: 'Delete list',
  deleteListCancel: 'Back',
  deleteCard: 'Delete Card',
  deleteCardConfirm: 'Delete card',
  deleteCardCancel: 'Close',
  editComment: 'Edit Comment',
  deleteComment: 'Delete Comment',
  deleteCommentConfirm: 'Delete comment',
  deleteCommentCancel: 'Close',
  switchToBoardView: 'Switch to Board View',
  switchToListView: 'Switch to List View',
  editCard: 'Edit Card',
  moveCard: 'Move Card',
  moveSubmit: 'Move',
} as const;

export const Placeholders = {
  listName: 'Enter list name...',
  cardNameAdd: 'Enter card name... [Ctrl+Enter] - open',
  cardNameRename: 'Enter card name...',
  commentNew: 'Enter comment... [Ctrl+Enter] - submit',
  commentEdit: 'Enter comment...',
  projectName: 'Enter project name...',
  boardName: 'Enter board name...',
} as const;

export const InputNames = {
  emailOrUsername: 'emailOrUsername',
  password: 'password',
} as const;

export const ListViewColumnHeaders = {
  name: 'Name',
  labels: 'Labels',
  dueDate: 'Due Date',
} as const;
