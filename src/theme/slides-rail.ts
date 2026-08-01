const slidesRailTheme = {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col',
    header: 'flex shrink-0 items-center justify-between gap-1 px-2 py-1.5',
    title: 'text-[11px] font-semibold text-surface',
    toolbar: 'flex shrink-0 items-center gap-1 px-2 pb-1.5',
    newSlide:
      'flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md border border-border bg-panel px-2 text-[11px] font-medium text-surface outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus',
    add: 'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-panel text-base leading-none text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    viewport: 'scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto px-2 pb-2',
    list: 'flex flex-col items-stretch gap-2',
    // Padding is unconditional so selecting a slide tints the row rather than moving it.
    cell: 'flex w-full cursor-pointer items-start gap-1.5 rounded-lg border-0 bg-transparent p-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-panel-focus data-[active=true]:bg-accent',
    index:
      'mt-1 w-4 shrink-0 text-right text-[11px] font-medium tabular-nums text-muted data-[active=true]:text-white',
    // Width clamped via inline style (min/max) so thumbs scale with the left panel
    thumbShell: 'min-w-0 shrink grow',
    activeChrome: 'rounded-md',
    thumb:
      'relative aspect-video w-full overflow-hidden rounded-md bg-white ring-1 ring-border data-[active=true]:ring-0',
    placeholder: 'flex size-full items-center justify-center text-muted'
  },
  variants: {
    active: {
      true: {
        cell: ''
      },
      false: {
        cell: 'hover:opacity-90'
      }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type SlidesRailTheme = typeof slidesRailTheme
export default slidesRailTheme
