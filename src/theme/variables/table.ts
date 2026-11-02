/**
 * The list is its own `tokens-list` container, so its columns follow the space left beside the
 * inspector. Below 42rem (`@2xl`) the CSS name moves under the token name; the value columns
 * repeat `--token-modes` times. The name keeps a width of its own, so a collection with more
 * modes than fit scrolls sideways instead of hiding its names.
 */
const COLUMNS =
  'grid-cols-[minmax(8rem,1.4fr)_repeat(var(--token-modes),minmax(6rem,1fr))] @2xl/tokens-list:grid-cols-[minmax(8rem,1.1fr)_minmax(8rem,1fr)_repeat(var(--token-modes),minmax(7rem,1fr))]'

export default {
  slots: {
    root: '@container/tokens-list flex min-w-0 flex-1 flex-col overflow-auto',
    header: `sticky top-0 z-10 grid min-w-min items-center gap-3 border-b border-border bg-panel px-4 py-2 text-[11px] font-medium text-muted ${COLUMNS}`,
    group: 'px-4 pt-3 pb-1 text-[11px] font-semibold text-muted',
    row: `${COLUMNS} grid min-w-min cursor-pointer items-center gap-3 px-4 py-1.5 text-xs text-surface outline-none transition-colors duration-100 hover:bg-hover data-[highlighted]:bg-hover data-[state=checked]:bg-hover data-[state=checked]:ring-1 data-[state=checked]:ring-accent/40 data-[state=checked]:ring-inset data-[dragging]:opacity-50 data-[drop=after]:shadow-[inset_0_-2px_0_var(--color-accent)] data-[drop=before]:shadow-[inset_0_2px_0_var(--color-accent)] motion-reduce:transition-none`,
    name: 'flex min-w-0 flex-col truncate',
    nameLine: 'flex min-w-0 items-center gap-1.5',
    /** A token's type, or that a formula gives its value. */
    icon: 'size-3 shrink-0 text-muted',
    /** The CSS name as its own column, from 42rem of list width. */
    cssColumn: 'hidden truncate font-mono text-[11px] text-muted @2xl/tokens-list:block',
    /** The CSS name column's title, in the header's own font like the others. */
    headerCssColumn: 'hidden @2xl/tokens-list:block',
    /** The CSS name under the token name, below 42rem of list width. */
    cssStacked: 'truncate font-mono text-[11px] text-muted @2xl/tokens-list:hidden',
    value:
      'flex min-w-0 animate-in items-center gap-1.5 truncate font-mono text-[11px] fade-in duration-150 motion-reduce:animate-none',
    /** An alias: its target's name, as wide as the name, and what it gives. */
    aliasPill: 'max-w-[65%] flex-none',
    aliasResult: 'truncate text-muted',
    /** Marks a value whose CSS is an expression, which its tooltip shows. */
    expressionBadge:
      'shrink-0 rounded-sm border border-border px-1 font-sans text-[9px] leading-3.5 font-medium text-muted',
    modeHeader: 'flex min-w-0 flex-col gap-0.5',
    /** When a mode applies: words in the UI font, a selector or query in the code font. */
    modeCondition:
      'truncate text-[11px] font-normal text-muted data-[code]:font-mono data-[code]:text-[10px]',
    empty: 'px-4 py-8 text-center text-xs text-muted'
  }
} as const
