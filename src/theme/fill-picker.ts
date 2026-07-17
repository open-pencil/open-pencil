const fillPickerTheme = {
  slots: {
    tab: 'flex size-6 cursor-pointer items-center justify-center rounded border-none p-0 text-muted transition-colors outline-none focus-visible:ring-1 focus-visible:ring-accent',
    barStop:
      'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 border-white/60 shadow-sm outline-none data-[dragging]:cursor-grabbing focus-visible:ring-1 focus-visible:ring-accent',
    listStop: 'flex items-center gap-1 py-0.5'
  },
  variants: {
    active: {
      true: {
        tab: 'bg-hover text-surface',
        barStop: 'border-white',
        listStop: 'rounded bg-hover/50'
      },
      false: {
        tab: 'hover:bg-hover hover:text-surface'
      }
    },
    dragging: {
      true: { barStop: 'cursor-grabbing' },
      false: {}
    }
  },
  defaultVariants: {
    active: false,
    dragging: false
  }
}

export type FillPickerTheme = typeof fillPickerTheme
export default fillPickerTheme
