/** Below this panel width (40rem) the inspector opens over the list instead of beside it. */
export const TOKENS_PANEL_COMPACT_WIDTH = 640

/** From this panel width (56rem) collections and groups move into a sidebar beside the list. */
export const TOKENS_PANEL_SIDEBAR_WIDTH = 896

/**
 * The list is its own `tokens-list` container, so its columns follow the space left beside the
 * inspector. Below 42rem (`@2xl`) the CSS name moves under the token name; the value columns
 * repeat `--token-modes` times.
 */
const COLUMNS =
  'grid-cols-[minmax(0,1.4fr)_repeat(var(--token-modes),minmax(6rem,1fr))] @2xl/tokens-list:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_repeat(var(--token-modes),minmax(7rem,1fr))]'

export default {
  slots: {
    root: '@container/tokens flex min-h-0 flex-1 flex-col',
    toolbar: 'flex shrink-0 items-center gap-1 border-b border-border px-3 py-1.5',
    body: 'flex min-h-0 flex-1 overflow-hidden',
    sidebar: 'flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border p-2',
    sidebarSection: 'flex flex-col gap-0.5',
    sidebarHeading: 'mb-1 flex items-center justify-between px-2',
    sidebarItem:
      'flex cursor-pointer items-center gap-2 rounded py-1 pr-2 pl-[calc(0.5rem+var(--depth,0)*0.75rem)] text-left text-xs text-surface hover:bg-hover data-[active]:bg-hover data-[active]:font-medium',
    sidebarGroupLabel: 'truncate',
    sidebarCount: 'ml-auto text-[11px] text-muted tabular-nums',
    list: '@container/tokens-list flex min-w-0 flex-1 flex-col overflow-auto',
    inspector: 'flex shrink-0 flex-col gap-4 overflow-y-auto p-4',
    output: 'flex shrink-0 flex-col border-t border-border',
    header: `sticky top-0 z-10 grid items-center gap-3 border-b border-border bg-panel px-4 py-2 text-[11px] font-medium text-muted ${COLUMNS}`,
    group: 'px-4 pt-3 pb-1 text-[11px] font-semibold text-muted',
    row: `${COLUMNS} grid cursor-pointer items-center gap-3 px-4 py-1.5 text-xs text-surface outline-none transition-colors duration-100 hover:bg-hover data-[highlighted]:bg-hover data-[state=checked]:bg-hover data-[state=checked]:ring-1 data-[state=checked]:ring-accent/40 data-[state=checked]:ring-inset data-[dragging]:opacity-50 data-[drop=after]:shadow-[inset_0_-2px_0_var(--color-accent)] data-[drop=before]:shadow-[inset_0_2px_0_var(--color-accent)] motion-reduce:transition-none`,
    name: 'flex min-w-0 flex-col truncate',
    nameLine: 'flex min-w-0 items-center gap-1.5',
    typeIcon: 'size-3 shrink-0 text-muted',
    cssName: 'truncate font-mono text-[11px] text-muted',
    /** The CSS name as its own column, from 42rem of list width. */
    cssColumn: 'hidden truncate font-mono text-[11px] text-muted @2xl/tokens-list:block',
    /** The CSS name column's title, in the header's own font like the others. */
    headerCssColumn: 'hidden @2xl/tokens-list:block',
    /** The CSS name under the token name, below 42rem of list width. */
    cssStacked: 'truncate font-mono text-[11px] text-muted @2xl/tokens-list:hidden',
    value:
      'flex min-w-0 animate-in items-center gap-1.5 truncate font-mono text-[11px] fade-in duration-150 motion-reduce:animate-none',
    expression: 'truncate font-mono text-[11px] text-primary',
    modeHeader: 'flex min-w-0 flex-col gap-0.5',
    /** When a mode applies: words in the UI font, a selector or query in the code font. */
    modeCondition:
      'truncate text-[11px] font-normal text-muted data-[code]:font-mono data-[code]:text-[10px]',
    section: 'flex flex-col gap-2',
    sectionTitle: 'text-[11px] font-semibold text-muted',
    field: 'flex flex-col gap-1',
    /** One mode in the collection inspector: its name, when it applies, and the CSS it writes. */
    /** The CSS a mode is written under, wrapped rather than cut so it reads in full. */
    modeCSS: 'font-mono text-[11px] break-all text-muted',
    mode: 'flex flex-col gap-1.5 border-b border-border pb-3 last:border-b-0 last:pb-0',
    label: 'text-[11px] text-muted',
    hint: 'text-[10px] text-muted',
    error: 'text-[10px] text-error',
    /** The fixed `--` in front of a CSS name the user types. */
    prefix: 'font-mono text-xs text-muted',
    /** A list cell being edited in place. */
    cellInput:
      'w-full min-w-0 rounded border border-accent bg-input px-1.5 py-0.5 text-xs text-surface outline-none',
    /** A mode's value control beside the button that points it at a variable. */
    valueRow: 'flex items-center gap-1 [&>*:first-child]:min-w-0 [&>*:first-child]:flex-1',
    valueControl: 'flex min-w-0 items-center gap-1.5',
    empty: 'px-4 py-8 text-center text-xs text-muted'
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
