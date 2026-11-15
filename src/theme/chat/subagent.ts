/** A subagent's card in a reply and the header of its thread. */
export default {
  slots: {
    card: 'flex w-full min-w-0 items-center gap-1 rounded-lg border border-border pe-1',
    open: 'flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-start text-2xs text-muted hover:bg-hover hover:text-surface',
    icon: 'size-3.5 shrink-0 text-primary',
    body: 'flex min-w-0 flex-1 flex-col',
    names: 'flex min-w-0 items-baseline gap-1.5',
    title: 'shrink-0 font-medium text-surface',
    subtitle: 'min-w-0 truncate text-muted',
    activity: 'min-h-lh truncate',
    state: 'flex shrink-0 items-center gap-1 text-3xs text-muted',
    spinner: 'size-3 animate-spin motion-reduce:animate-none',
    chevron: 'size-3 shrink-0 text-muted',
    intro: 'border-b border-border px-3 py-2 text-2xs text-muted',
    transcript: 'px-3 py-3',
    empty: 'px-3 py-6 text-center text-2xs text-muted'
  }
} as const
