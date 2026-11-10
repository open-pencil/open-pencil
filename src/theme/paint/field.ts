export default {
  slots: {
    root: 'flex h-6 min-w-0 flex-1 items-center overflow-hidden rounded border border-transparent bg-panel-field text-2xs transition-colors hover:bg-panel-field-hover focus-within:border-panel-focus focus-within:bg-panel-field-hover',
    preview: 'flex shrink-0 items-center ps-1',
    value: 'flex min-w-0 flex-1 items-center ps-1 pe-1',
    divider: 'h-4 w-px shrink-0 bg-muted/40',
    opacity: 'h-full w-13 flex-none shrink-0',
    binding: 'flex shrink-0 items-center pe-0.5'
  }
} as const
