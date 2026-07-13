const panelHeaderTheme = {
  slots: {
    root: 'grid min-w-0 grid-cols-[var(--spacing-panel-icon)_minmax(0,1fr)_auto] items-center gap-panel border-b border-border px-panel-x py-panel-y text-surface',
    icon: 'flex size-panel-icon items-center justify-center text-muted',
    title: 'min-w-0 truncate text-xs font-semibold text-surface',
    actions:
      'flex min-w-0 items-center justify-end gap-0.5 [&_[data-slot=icon-button]]:size-control [&_[data-slot=icon-button]]:rounded-panel'
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
