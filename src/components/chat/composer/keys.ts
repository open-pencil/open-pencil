/** The message field's keys as shortcut tokens: its keymap binds them and its hints print them. */
export const CHAT_COMPOSER_KEYS = {
  send: 'Enter',
  /** While the agent works, waits until it has finished instead of steering it. */
  followUp: 'ALT+Enter',
  newline: 'SHIFT+Enter'
} as const
