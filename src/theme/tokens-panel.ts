/**
 * The list is its own `tokens-list` container, so its columns follow the space left beside the
 * inspector. Below 42rem (`@2xl`) the CSS name moves under the token name; the value columns
 * repeat `--token-modes` times.
 */
/** Below this panel width (40rem) the inspector opens over the list instead of beside it. */
export const TOKENS_PANEL_COMPACT_WIDTH = 640

const COLUMNS =
  'grid-cols-[minmax(0,1.4fr)_repeat(var(--token-modes),minmax(6rem,1fr))] @2xl/tokens-list:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_repeat(var(--token-modes),minmax(7rem,1fr))]'

export default {
  slots: {
    root: '@container/tokens flex min-h-0 flex-1 flex-col',
    list: '@container/tokens-list flex min-w-0 flex-1 flex-col overflow-auto',
    inspector: 'flex shrink-0 flex-col gap-4 overflow-y-auto p-4',
    output: 'flex shrink-0 flex-col border-t border-border',
    header: `sticky top-0 z-10 grid items-center gap-3 border-b border-border bg-panel px-4 py-2 text-[11px] font-medium text-muted ${COLUMNS}`,
    group: 'px-4 pt-3 pb-1 text-[11px] font-semibold text-muted',
    row: `${COLUMNS} grid cursor-pointer items-center gap-3 px-4 py-1.5 text-xs text-surface outline-none transition-colors duration-100 hover:bg-hover data-[highlighted]:bg-hover data-[state=checked]:bg-hover data-[state=checked]:ring-1 data-[state=checked]:ring-accent/40 data-[state=checked]:ring-inset motion-reduce:transition-none`,
    name: 'flex min-w-0 flex-col truncate',
    cssName: 'truncate font-mono text-[11px] text-muted',
    /** The CSS name as its own column, from 42rem of list width. */
    cssColumn: 'hidden truncate font-mono text-[11px] text-muted @2xl/tokens-list:block',
    /** The CSS name under the token name, below 42rem of list width. */
    cssStacked: 'truncate font-mono text-[11px] text-muted @2xl/tokens-list:hidden',
    value:
      'flex min-w-0 animate-in items-center gap-1.5 truncate font-mono text-[11px] fade-in duration-150 motion-reduce:animate-none',
    expression: 'truncate font-mono text-[11px] text-accent',
    modeHeader: 'flex min-w-0 flex-col gap-0.5',
    modeCondition: 'truncate font-mono text-[10px] font-normal text-muted/80',
    section: 'flex flex-col gap-2',
    sectionTitle: 'text-[11px] font-semibold text-muted',
    field: 'flex flex-col gap-1',
    label: 'text-[11px] text-muted',
    hint: 'text-[10px] text-muted',
    backBar:
      'flex shrink-0 items-center gap-2 border-b border-border px-2 py-1.5 text-xs text-surface'
  },
  variants: {
    /** Beside the token list on desktop; the whole panel, behind a back button, on mobile. */
    layout: {
      side: { inspector: 'w-64 border-l border-border @6xl/tokens:w-72', output: 'h-56' },
      full: { inspector: 'min-h-0 w-full flex-1', output: 'min-h-0 flex-1 border-t-0' }
    }
  },
  defaultVariants: { layout: 'side' }
} as const
