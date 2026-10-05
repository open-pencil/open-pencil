export default {
  slots: {
    root: 'flex min-h-0 flex-1 overflow-hidden',
    list: 'flex min-w-0 flex-1 flex-col overflow-auto',
    inspector: 'flex w-72 shrink-0 flex-col gap-4 overflow-y-auto border-l border-border p-4',
    header:
      'sticky top-0 z-10 grid items-center gap-3 border-b border-border bg-panel px-4 py-2 text-[11px] font-medium text-muted',
    group: 'px-4 pt-3 pb-1 text-[11px] font-semibold text-muted',
    row: 'grid cursor-pointer items-center gap-3 px-4 py-1.5 text-xs text-surface hover:bg-hover data-[selected]:bg-hover data-[selected]:ring-1 data-[selected]:ring-accent/40 data-[selected]:ring-inset',
    name: 'flex min-w-0 items-center gap-2 truncate',
    cssName: 'truncate font-mono text-[11px] text-muted',
    value: 'flex min-w-0 items-center gap-1.5 truncate font-mono text-[11px]',
    expression: 'truncate font-mono text-[11px] text-accent',
    modeHeader: 'flex min-w-0 flex-col gap-0.5',
    modeCondition: 'truncate font-mono text-[10px] font-normal text-muted/80',
    section: 'flex flex-col gap-2',
    sectionTitle: 'text-[11px] font-semibold text-muted',
    field: 'flex flex-col gap-1',
    label: 'text-[11px] text-muted',
    hint: 'text-[10px] text-muted'
  }
} as const
