import { tv } from 'tailwind-variants'

export const cloudConnect = tv({
  slots: {
    choices: 'flex flex-col gap-2',
    choice:
      'group flex w-full items-center gap-3 rounded-lg border border-border bg-panel-field px-3 py-2.5 text-left outline-none hover:bg-panel-field-hover focus-visible:ring-2 focus-visible:ring-accent/50 data-[state=checked]:border-panel-focus data-[state=checked]:bg-panel-selected-muted',
    choiceIcon:
      'flex size-8 shrink-0 items-center justify-center rounded-md bg-panel text-muted group-data-[state=checked]:text-primary',
    choiceBody: 'min-w-0 flex-1',
    choiceLabel: 'block text-xs font-medium text-surface',
    choiceDescription: 'mt-0.5 block truncate text-[11px] text-muted',
    choiceMark:
      'size-3.5 shrink-0 rounded-full border border-border group-data-[state=checked]:border-4 group-data-[state=checked]:border-accent',
    address: 'mt-3 flex flex-col gap-1.5',
    addressLabel: 'text-[11px] font-medium text-muted',
    methods: 'flex flex-col gap-1.5',
    note: 'mt-3 text-[11px] text-muted',
    device: 'flex flex-col items-center gap-3 py-2',
    deviceLabel: 'text-[11px] font-medium text-muted',
    deviceStatus: 'flex items-center gap-2 text-[11px] text-muted',
    spinner: 'size-3.5 shrink-0 animate-spin motion-reduce:animate-none'
  }
})
