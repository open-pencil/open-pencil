import { tv } from 'tailwind-variants'

/** Connected Cloud servers in Settings, one row each with its account and session. */
export const cloudServers = tv({
  slots: {
    row: 'flex items-center gap-3 px-3 py-2.5',
    icon: 'flex size-8 shrink-0 items-center justify-center rounded-md bg-panel-field text-muted',
    body: 'min-w-0 flex-1',
    titleRow: 'flex min-w-0 items-center gap-1.5',
    title: 'truncate text-xs font-medium text-surface',
    host: 'truncate text-[11px] text-muted',
    badge: 'shrink-0 rounded bg-panel-field px-1.5 py-0.5 text-[10px] font-medium text-muted',
    account: 'mt-0.5 flex min-w-0 items-center gap-1.5 text-[11px] text-muted',
    accountText: 'truncate',
    expired: 'mt-0.5 flex items-center gap-1 text-[11px] text-warning-text',
    trailing: 'flex shrink-0 items-center gap-1',
    choices: 'flex flex-col gap-1.5',
    choiceIcon: 'flex size-8 shrink-0 items-center justify-center rounded-md bg-panel text-muted'
  }
})
