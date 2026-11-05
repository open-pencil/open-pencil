const canvasPaneHeaderTheme = {
  slots: {
    root: '@container/pane-header relative flex h-7 shrink-0 items-center gap-1 border-b border-border bg-panel px-1.5 text-muted after:absolute after:inset-x-0 after:bottom-0 after:h-px after:bg-transparent',
    title: 'min-w-0 flex-1 truncate px-1 text-2xs',
    badge:
      'flex h-5 shrink-0 items-center gap-1 rounded bg-accent/15 px-1.5 text-3xs font-medium text-primary',
    badgeLabel: 'hidden @xs/pane-header:inline',
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
