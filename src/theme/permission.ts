export default {
  slots: {
    root: 'flex h-full flex-col bg-panel text-surface select-none',
    main: 'flex min-h-0 flex-1 gap-4 px-5 pt-5 pb-4',
    icon: 'size-12 shrink-0',
    content: 'flex min-w-0 flex-1 flex-col',
    title: 'text-sm font-semibold text-surface',
    subtitle: 'mt-0.5 text-xs text-muted',
    detail:
      'mt-3 min-h-0 flex-1 overflow-auto rounded-lg border border-border bg-input select-text',
    input: 'p-2 text-3xs text-muted whitespace-pre-wrap',
    plan: 'px-3 py-2 text-xs',
    footer: 'flex shrink-0 flex-col gap-1.5 border-t border-border px-5 py-3',
    waiting: 'text-2xs text-muted'
  }
} as const
