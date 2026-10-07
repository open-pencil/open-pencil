const radioGroupTheme = {
  slots: {
    root: 'flex flex-col gap-2 data-[orientation=horizontal]:flex-row data-[orientation=horizontal]:flex-wrap',
    option:
      'flex cursor-pointer items-start gap-2 text-xs text-surface has-[[data-disabled]]:cursor-not-allowed has-[[data-disabled]]:opacity-50',
    item: 'mt-px flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-panel-field outline-none transition-colors hover:border-accent/60 focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=checked]:border-accent data-[state=checked]:bg-accent data-[disabled]:pointer-events-none',
    indicator: 'size-1.5 rounded-full bg-white',
    text: 'flex min-w-0 flex-col',
    label: 'font-medium',
    description: 'mt-1 text-muted'
  }
}

export type RadioGroupTheme = typeof radioGroupTheme
export default radioGroupTheme
