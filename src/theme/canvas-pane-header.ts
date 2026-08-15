const canvasPaneHeaderTheme = {
  slots: {
    root: 'relative flex h-7 shrink-0 items-center gap-1 border-b border-border bg-panel px-1.5 text-muted after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent',
    title: 'min-w-0 flex-1 truncate px-1 text-[11px]',
    zoom: 'shrink-0 px-1 text-[11px] tabular-nums text-muted',
    actions: 'flex shrink-0 items-center gap-0.5',
    icon: 'size-3.5'
  },
  variants: {
    active: {
      true: {
        root: 'text-surface after:bg-accent'
      },
      false: {}
    }
  },
  defaultVariants: {
    active: false
  }
}

export type CanvasPaneHeaderTheme = typeof canvasPaneHeaderTheme
export default canvasPaneHeaderTheme
