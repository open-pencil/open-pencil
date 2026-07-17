const layoutAlignmentTheme = {
  slots: {
    grid: 'grid w-fit grid-cols-3 gap-0.5',
    cell: 'flex size-6 cursor-pointer items-center justify-center rounded border text-[11px]',
    dot: 'size-1.5 rounded-full bg-current'
  },
  variants: {
    active: {
      true: { cell: 'border-accent bg-accent/10 text-accent' },
      false: { cell: 'border-border text-muted hover:bg-hover hover:text-surface' }
    },
    disabled: {
      true: { cell: 'pointer-events-none opacity-50' },
      false: {}
    }
  },
  defaultVariants: {
    active: false,
    disabled: false
  }
}

export type LayoutAlignmentTheme = typeof layoutAlignmentTheme
export default layoutAlignmentTheme
