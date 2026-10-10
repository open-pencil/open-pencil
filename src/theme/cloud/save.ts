import { tv } from 'tailwind-variants'

/** Choosing where on Cloud a document from this device goes. */
export const cloudSave = tv({
  slots: {
    field: 'flex flex-col gap-1.5',
    label: 'text-[11px] font-medium text-muted',
    server: 'mt-1 text-[11px] font-medium text-muted',
    choices: 'flex flex-col gap-1.5',
    choice:
      'group flex w-full items-center gap-3 rounded-lg border border-border bg-panel-field px-3 py-2 text-left outline-none hover:bg-panel-field-hover focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-default disabled:opacity-50 disabled:hover:bg-panel-field data-[state=checked]:border-panel-focus data-[state=checked]:bg-panel-selected-muted',
    choiceIcon: 'size-3.5 shrink-0 text-muted group-data-[state=checked]:text-primary',
    choiceLabel: 'min-w-0 flex-1 truncate text-xs text-surface',
    choiceRole: 'shrink-0 text-[11px] text-muted',
    choiceMark:
      'size-3.5 shrink-0 rounded-full border border-border group-data-[state=checked]:border-4 group-data-[state=checked]:border-accent',
    stack: 'flex flex-col gap-4',
    note: 'text-[11px] leading-relaxed text-muted',
    progress: 'flex flex-col gap-1.5',
    progressTrack: 'h-1 overflow-hidden rounded-full bg-panel-field',
    progressBar: 'h-full rounded-full bg-accent transition-[width] motion-reduce:transition-none',
    progressText: 'text-[11px] text-muted tabular-nums'
  }
})
