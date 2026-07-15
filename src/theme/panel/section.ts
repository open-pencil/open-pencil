const panelSectionTheme = {
  slots: {
    root: 'border-b border-border px-panel-x py-panel-y text-surface data-[disabled]:opacity-60',
    header: 'mb-panel grid min-w-0 items-center gap-panel',
    title:
      'min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[11px] leading-none font-semibold text-surface',
    actions:
      'flex h-control w-panel-rail shrink-0 items-center justify-end gap-0.5 [&_[data-slot=icon-button]]:size-control [&_[data-slot=icon-button]]:rounded-panel',
    body: 'min-w-0 data-[state=closed]:hidden'
  },
  variants: {
    actions: {
      true: {
        header: 'grid-cols-[minmax(0,1fr)_var(--spacing-panel-rail)]'
      },
      false: {
        header: 'grid-cols-[minmax(0,1fr)]'
      }
    }
  }
}

export type PanelSectionTheme = typeof panelSectionTheme
export default panelSectionTheme
