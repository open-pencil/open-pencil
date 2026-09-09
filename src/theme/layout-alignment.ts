const layoutAlignmentTheme = {
  slots: {
    grid: 'grid w-fit grid-cols-3 gap-0.5 rounded bg-panel-field p-0.5',
    cell: 'flex size-6 cursor-pointer items-center justify-center rounded border-0 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
    dot: 'size-1.5 rounded-full bg-current'
  },
  variants: {
    active: {
      true: { cell: 'bg-accent/10 text-accent' },
      false: { cell: 'text-muted hover:bg-hover hover:text-surface' }
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
