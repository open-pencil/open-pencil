/** Creating a Cloud workspace and managing who belongs to it. */
export default {
  slots: {
    form: 'flex flex-col gap-1.5',
    label: 'text-[11px] font-medium text-muted',
    stack: 'flex flex-col gap-4',
    inline: 'flex items-center gap-2',
    section: 'flex flex-col gap-2',
    sectionTitle: 'text-[11px] font-medium text-muted',
    sent: 'flex flex-col gap-1.5',
    note: 'text-[11px] text-muted',
    list: 'flex flex-col divide-y divide-border rounded border border-border',
    row: 'flex items-center gap-3 px-3 py-2',
    person: 'flex min-w-0 flex-1 flex-col',
    personName: 'truncate text-xs text-surface',
    personEmail: 'truncate text-[11px] text-muted',
    personDetail: 'text-[11px] text-pretty text-muted',
    you: 'ml-1 text-[11px] text-muted',
    role: 'shrink-0 text-[11px] text-muted',
    roleSelect: 'w-28 shrink-0',
    /** A role in the invite menu, with what it lets someone do on a second line. */
    roleItem: 'h-auto max-w-80 py-1',
    dangerTitle: 'text-[11px] font-medium text-error',
    dangerList: 'flex flex-col divide-y divide-error-border rounded border border-error-border',
    dangerRow: 'flex items-center gap-3 px-3 py-2.5',
    dangerDescription: 'text-[11px] text-pretty text-muted',
    confirmName: 'mt-3 flex flex-col gap-1.5',
    pendingIcon:
      'flex size-6 shrink-0 items-center justify-center rounded-full bg-panel-field text-muted'
  }
} as const
