const variableTableTheme = {
  slots: {
    modeLabel: 'cursor-default',
    resizeHandle: 'absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none select-none',
    row: 'group border-b border-border/30 hover:bg-hover/50'
  },
  variants: {
    defaultMode: {
      true: { modeLabel: 'text-surface' },
      false: {}
    },
    resizing: {
      true: { resizeHandle: 'bg-accent' },
      false: { resizeHandle: 'bg-transparent hover:bg-border' }
    }
  },
  defaultVariants: {
    defaultMode: false,
    resizing: false
  }
}

export type VariableTableTheme = typeof variableTableTheme
export default variableTableTheme
