/** Below this panel width (40rem) the inspector opens over the list instead of beside it. */
export const TOKENS_PANEL_COMPACT_WIDTH = 640

/** From this panel width (56rem) collections and groups move into a sidebar beside the list. */
export const TOKENS_PANEL_SIDEBAR_WIDTH = 896

export default {
  slots: {
    root: '@container/tokens flex min-h-0 flex-1 flex-col',
    toolbar: 'flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5',
    body: 'flex min-h-0 flex-1 overflow-hidden'
  }
} as const
