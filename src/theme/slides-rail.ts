const slidesRailTheme = {
  slots: {
    panel: 'flex min-h-0 flex-1 flex-col',
    header: 'flex shrink-0 items-center justify-between gap-1 px-2 py-1.5',
    title: 'text-[11px] font-semibold text-surface',
    toolbar: 'flex shrink-0 items-center gap-1 px-2 pb-1.5',
    newSlide:
      'flex h-7 min-w-0 flex-1 cursor-pointer items-center justify-center rounded-md border border-border bg-panel px-2 text-[11px] font-medium text-surface outline-none hover:bg-hover focus-visible:ring-1 focus-visible:ring-panel-focus',
    add: 'flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-md border border-border bg-panel text-base leading-none text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    viewport:
      'scrollbar-thin min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-y-contain px-2 pb-2',
    list: 'flex flex-col items-stretch gap-2 will-change-transform transition-transform duration-200 ease-[cubic-bezier(0.22,1.35,0.36,1)] motion-reduce:!transform-none motion-reduce:transition-none',
    // Padding is unconditional so selecting a slide tints the row rather than moving it.
    // `relative` anchors the reorder drop indicator to the cell.
    cell: 'relative flex w-full cursor-pointer items-start gap-1.5 rounded-lg border-0 bg-transparent p-1 text-left outline-none focus-visible:ring-1 focus-visible:ring-panel-focus data-[active=true]:bg-accent',
    // Inset to the thumb gutter so the line reads as "between these two slides".
    dropIndicator: 'pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent',
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
    },
    dragging: {
      true: { cell: 'opacity-60' },
      false: {}
    },
    dropPosition: {
      // The gap between cells is 8px, so pull the line half a gap clear of the
      // cell padding to sit centred in the gap rather than against a thumb.
      before: { dropIndicator: '-top-1' },
      after: { dropIndicator: '-bottom-1' }
    }
  },
  defaultVariants: {
    active: false,
    dragging: false
  }
}

export type SlidesRailTheme = typeof slidesRailTheme
export default slidesRailTheme
