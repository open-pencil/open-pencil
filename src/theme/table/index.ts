/**
 * Rows under labelled columns. The frame is its own `table` container, so a column can hide below
 * a width of the space it is given (`@xl/table:table-cell`) rather than the window's.
 */
export default {
  slots: {
    root: '@container/table relative overflow-hidden rounded-lg border border-border bg-panel',
    scroller: 'overflow-x-auto',
    table: 'w-full border-collapse text-start text-xs text-surface',
    header: 'border-b border-border',
    head: 'h-8 px-3 align-middle text-2xs font-medium whitespace-nowrap text-muted first:ps-4 last:pe-4',
    // While newer rows load the old ones stay, a little faded, so the table never jumps.
    body: 'transition-opacity duration-150 data-refreshing:opacity-60 motion-reduce:transition-none',
    row: 'border-b border-border transition-colors duration-100 last:border-b-0 hover:bg-hover/40 motion-reduce:transition-none',
    cell: 'h-12 px-3 py-2 align-middle first:ps-4 last:pe-4',
    empty: 'px-4 py-8',
    /** A bar that pulses along the top edge while newer rows load. */
    refresh: 'pointer-events-none absolute inset-x-0 top-0 z-10',
    footer: 'border-t border-border px-4 py-1.5',
    pagination: 'flex items-center justify-between gap-2 text-2xs text-muted',
    range: 'tabular-nums',
    pages: 'flex items-center gap-0.5'
  }
} as const
