const panelHeaderTheme = {
  slots: {
    root: 'grid min-w-0 grid-cols-[14px_minmax(0,1fr)_auto] items-center gap-1.5 border-b border-border px-3 py-2 text-surface',
    icon: 'flex size-3.5 items-center justify-center text-muted',
    title: 'min-w-0 truncate text-xs font-semibold text-surface',
    actions:
      'flex min-w-0 items-center justify-end gap-0.5 [&_[data-slot=icon-button]]:size-6 [&_[data-slot=icon-button]]:rounded'
  },
  variants: {
    component: {
      true: {
        icon: 'text-component',
        title: 'text-component'
      },
      false: {}
    }
  },
  defaultVariants: {
    component: false
  }
}

export type PanelHeaderTheme = typeof panelHeaderTheme
export default panelHeaderTheme
