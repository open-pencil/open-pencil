export type MarkdownDensity = 'compact' | 'comfortable'

// Element and density rules for rendered Markdown live in markdown.css, keyed by
// `data-markdown-density` and `data-markdown-mode`.
export default {
  slots: {
    root: 'markdown-root',
    markdown: 'markdown-content'
  }
} as const
