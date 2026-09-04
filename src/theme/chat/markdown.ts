import { tv } from 'tailwind-variants'

export const chatMarkdownTheme = tv({
  slots: {
    root: 'chat-markdown-root',
    markdown: [
      'chat-markdown',
      '[--accent:var(--color-hover)]',
      '[--accent-foreground:var(--color-surface)]',
      '[--background:var(--color-input)]',
      '[--border:var(--color-border)]',
      '[--foreground:var(--color-surface)]',
      '[--muted:var(--color-hover)]',
      '[--muted-foreground:var(--color-muted)]',
      '[--popover:var(--color-panel)]',
      '[--popover-foreground:var(--color-surface)]',
      '[--primary:var(--color-accent)]',
      '[--primary-foreground:white]'
    ]
  }
})
