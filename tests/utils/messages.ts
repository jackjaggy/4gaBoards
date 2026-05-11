// User-visible messages — error banners and confirmation-dialog body copy.

export const ErrorMessages = {
  invalidCredentials: 'Invalid username or password',
} as const;

export const ConfirmDialogMessages = {
  deleteList: 'Are you sure you want to delete this list?',
  deleteCard: 'Are you sure you want to delete this card?',
  deleteComment: 'Are you sure you want to delete this comment?',
} as const;
