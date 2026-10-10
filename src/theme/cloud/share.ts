import { tv } from 'tailwind-variants'

export const cloudShare = tv({
  slots: {
    invite: 'flex items-center gap-2',
    heading: 'mb-2 text-[11px] font-semibold text-muted',
    list: 'flex flex-col',
    row: 'flex min-h-11 items-center gap-3 py-1.5',
    rowBody: 'min-w-0 flex-1',
    rowName: 'flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-surface',
    rowDetail: 'block truncate text-[11px] text-muted',
    rowRole: 'shrink-0 px-2 text-[11px] text-muted',
    pendingAvatar:
      'flex size-7 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted',
    groupAvatar:
      'flex size-7 shrink-0 items-center justify-center rounded-full bg-panel-field text-muted',
    access: 'flex items-center gap-3 rounded-lg border border-border px-3 py-2.5',
    accessIcon:
      'flex size-8 shrink-0 items-center justify-center rounded-md bg-panel-field text-muted data-[access=link]:bg-success/10 data-[access=link]:text-success',
    accessBody: 'min-w-0 flex-1',
    accessLabel: 'text-xs font-medium text-surface',
    accessDetail: 'text-[11px] text-muted',
    footnote: 'text-[11px] text-muted'
  }
})
