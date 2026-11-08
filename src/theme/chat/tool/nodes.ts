export default {
  slots: {
    root: 'flex flex-wrap gap-1',
    node: 'inline-flex max-w-40 cursor-pointer items-center gap-1 rounded border border-border bg-input px-1.5 py-0.5 text-3xs text-surface hover:border-accent hover:text-primary disabled:cursor-default disabled:opacity-50 disabled:hover:border-border disabled:hover:text-surface',
    icon: 'size-3 shrink-0 text-muted',
    label: 'truncate'
  }
} as const
