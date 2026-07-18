export default {
  slots: {
    root: 'flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded border border-transparent bg-panel-field text-[11px] transition-colors hover:bg-panel-field-hover focus-within:border-panel-focus focus-within:bg-panel-field-hover',
    preview: 'flex shrink-0 items-center pl-0.5',
    value: 'flex min-w-0 flex-1 items-center px-1.5',
    divider: 'h-4 w-px shrink-0 bg-border',
    opacity: 'h-full w-14 shrink-0',
    binding: 'flex shrink-0 items-center pr-0.5'
  }
} as const
