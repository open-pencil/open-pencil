import { tv } from 'tailwind-variants'

export type MarkdownDensity = 'compact' | 'comfortable'

// vue-stream-markdown styles itself with shadcn variables; map them to app tokens.
// Density rules live in markdown.css, keyed by `data-markdown-density`.
export const markdownTheme = tv({
  slots: {
    root: 'markdown-root',
    markdown: [
      'markdown-content',
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
