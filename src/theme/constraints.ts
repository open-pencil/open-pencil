const constraintsTheme = {
  slots: {
    root: 'grid grid-cols-[72px_minmax(0,1fr)] items-center gap-1.5',
    diagram: 'relative h-16 w-[72px] rounded border border-border bg-panel-field',
    pin: 'absolute flex cursor-pointer items-center justify-center rounded-sm border border-transparent bg-transparent text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus',
    pinMark: 'block rounded-full bg-current',
    scaleBadge:
      'pointer-events-none absolute inset-2 flex items-center justify-center text-[9px] font-medium tracking-wide text-accent uppercase',
    selects: 'grid min-w-0 gap-1.5'
  },
  variants: {
    active: {
      true: { pin: 'border-accent bg-accent/12 text-accent' },
      false: {}
    },
    scale: {
      true: { diagram: 'ring-1 ring-accent/50' },
      false: {}
    },
    pinPosition: {
      horizontalLeading: { pin: 'top-1/2 left-1 h-7 w-4 -translate-y-1/2', pinMark: 'h-5 w-0.5' },
      horizontalTrailing: { pin: 'top-1/2 right-1 h-7 w-4 -translate-y-1/2', pinMark: 'h-5 w-0.5' },
      verticalLeading: { pin: 'top-1 left-1/2 h-4 w-7 -translate-x-1/2', pinMark: 'h-0.5 w-5' },
      verticalTrailing: { pin: 'bottom-1 left-1/2 h-4 w-7 -translate-x-1/2', pinMark: 'h-0.5 w-5' },
      horizontalCenter: { pin: 'top-[21px] left-[27px] h-6 w-4', pinMark: 'h-4 w-0.5' },
      verticalCenter: { pin: 'top-[25px] left-[33px] h-4 w-6', pinMark: 'h-0.5 w-4' }
    }
  },
  defaultVariants: {
    active: false,
    scale: false
  }
}

export type ConstraintsTheme = typeof constraintsTheme
export default constraintsTheme
