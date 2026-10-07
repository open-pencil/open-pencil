import { tv } from 'tailwind-variants'

export type MarkdownDensity = 'compact' | 'comfortable'

// vue-stream-markdown styles itself with shadcn variables; markdown.css maps them to app tokens
// on its `.stream-markdown` elements, including the dialogs it teleports out of a message.
// Density rules live there too, keyed by `data-markdown-density`.
export const markdownTheme = tv({
  slots: {
    root: 'markdown-root',
    markdown: 'markdown-content'
  }
})
