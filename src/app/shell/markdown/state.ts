export type MarkdownSurface = 'message' | 'reasoning'

export interface MarkdownRenderOptions {
  mode: 'static' | 'streaming'
  surface: MarkdownSurface
}

const STREAMING_HISTORY_KEY = 'streaming'

export function markdownRenderKey({ mode, surface }: MarkdownRenderOptions): string {
  return `${surface}-${mode === 'static' ? 'static' : STREAMING_HISTORY_KEY}`
}
