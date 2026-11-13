export default {
  slots: {
    root: 'flex min-w-0 flex-col gap-4',
    header: 'flex flex-wrap items-start gap-x-4 gap-y-2',
    heading: 'min-w-0 flex-1',
    title: 'truncate text-base font-semibold',
    subtitle: 'mt-1 text-xs text-muted',
    list: 'overflow-hidden rounded-lg border border-border',
    row: 'flex min-h-14 items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 sm:px-4',
    icon: 'size-4 shrink-0 text-primary',
    body: 'min-w-0 flex-1',
    name: 'block truncate text-xs font-medium',
    metadata: 'mt-0.5 block truncate text-3xs text-muted',
    left: 'hidden shrink-0 text-3xs text-muted sm:inline',
    actions: 'flex shrink-0 items-center gap-1',
    skeleton:
      'h-14 animate-pulse border-b border-border bg-panel-field/40 last:border-b-0 motion-reduce:animate-none'
  },
  variants: {
    kind: {
      design: {},
      board: { icon: 'text-board' }
    }
  }
}
