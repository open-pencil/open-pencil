/** A subagent's card in a reply and the header of its thread. */
export default {
  slots: {
    card: 'flex w-full min-w-0 cursor-pointer items-center gap-2 rounded-lg border border-border px-2 py-1.5 text-start text-2xs text-muted hover:bg-hover hover:text-surface',
    icon: 'size-3.5 shrink-0 text-primary',
    body: 'flex min-w-0 flex-1 flex-col',
    title: 'truncate font-medium text-surface',
    activity: 'truncate',
    state: 'flex shrink-0 items-center gap-1 text-3xs',
    spinner: 'size-3 animate-spin motion-reduce:animate-none',
    chevron: 'size-3 shrink-0 text-muted',
    intro: 'space-y-0.5 border-b border-border px-3 py-2 text-2xs',
    introTitle: 'font-medium text-surface',
    introDescription: 'text-muted',
    transcript: 'px-3 py-3',
    empty: 'px-3 py-6 text-center text-2xs text-muted'
  }
} as const
