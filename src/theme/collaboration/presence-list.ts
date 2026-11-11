const NAME =
  'min-w-0 cursor-default truncate text-start text-2xs text-surface outline-none focus-visible:ring-1 focus-visible:ring-panel-focus'

/** People in a room, each followed by their agents. */
export default {
  slots: {
    root: 'flex flex-col gap-0.5',
    person: 'flex h-7 min-w-0 items-center gap-2',
    agent: 'flex h-7 min-w-0 items-center gap-2 ps-8',
    agentIcon: 'size-3.5 shrink-0',
    name: [NAME, 'flex-1'],
    // An agent's callsign keeps its width; the status beside it truncates first.
    agentName: NAME,
    status: 'min-w-0 flex-1 truncate text-end text-3xs text-muted',
    renameInput:
      'h-6 min-w-0 flex-1 rounded border border-accent bg-input px-1.5 text-2xs text-surface outline-none'
  }
} as const
