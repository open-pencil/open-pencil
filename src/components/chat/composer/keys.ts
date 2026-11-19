import type { HotkeyChord } from '@tanstack/hotkeys'

/** The message field's keys as shortcuts: its keymap binds them and its hints print them. */
export const CHAT_COMPOSER_KEYS = {
  send: 'Enter',
  /** While the agent works, waits until it has finished instead of steering it. */
  followUp: 'Alt+Enter',
  newline: 'Shift+Enter'
} as const satisfies Record<string, HotkeyChord>
