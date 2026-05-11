// Centralised test data: credentials, name prefixes, and API request payload shapes.

export interface Credentials {
  username: string;
  password: string;
}

export const DEMO_CREDENTIALS: Credentials = {
  username: 'demo',
  password: 'demo',
};

export const INVALID_CREDENTIALS: Credentials = {
  username: 'demo',
  password: 'definitely-wrong-password',
};

// User initials shown in the header avatar button after the demo user logs in.
export const DEMO_USER_INITIALS = 'DD';

export const NamePrefixes = {
  project: 'E2E Project',
  board: 'E2E Board',
  taskList: 'Tasks',
  todoList: 'To Do',
  backlogList: 'Backlog',
  sprintBacklogList: 'Sprint Backlog',
  doomedList: 'Doomed List',
  preservedList: 'Preserved List',
  buyMilkCard: 'Buy milk',
  originalCardTitle: 'Original Title',
  renamedCardTitle: 'Renamed Title',
  disposableCard: 'Disposable Card',
  preservedCard: 'Preserved Card',
  sampleCard: 'Sample card',
  firstComment: 'First comment',
  originalComment: 'Original comment',
  editedComment: 'Edited comment',
  doomedComment: 'Doomed comment',
  preservedComment: 'Preserved Comment',
  // DnD specs ----------------------------------------------------------------
  todoListDnd: 'To Do',
  doingListDnd: 'Doing',
  doneListDnd: 'Done',
  cardAlpha: 'Alpha',
  cardBravo: 'Bravo',
  cardCharlie: 'Charlie',
  cardDelta: 'Delta',
  secondBoard: 'Destination Board',
  taskWriteSpec: 'Write spec',
  taskAddTests: 'Add tests',
  taskShipIt: 'Ship it',
} as const;

export const EMPTY_CREDENTIALS: Credentials = {
  username: '',
  password: '',
};

export const USERNAME_ONLY_CREDENTIALS: Credentials = {
  username: 'demo',
  password: '',
};

export const WHITESPACE_INPUT = '   ';

// API request fields that aren't user-facing but the create-board endpoint requires.
export const BoardCreatePayload = {
  position: 65535,
  isGithubConnected: false,
} as const;
