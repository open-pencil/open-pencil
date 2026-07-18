const panelSectionTheme = {
  slots: {
    root: 'border-b border-border px-3 pb-3 text-surface data-[disabled]:opacity-60',
    header: 'grid h-8 min-w-0 items-center gap-1.5',
    title:
      'min-w-0 cursor-pointer truncate border-0 bg-transparent p-0 text-left text-[11px] leading-none font-semibold text-surface',
    actions:
      'flex h-7 w-[26px] shrink-0 items-center justify-end gap-0.5 [&_[data-slot=icon-button]]:size-6 [&_[data-slot=icon-button]]:rounded',
    body: 'min-w-0 data-[state=closed]:hidden'
  },
  variants: {
    actions: {
      true: {
        header: 'grid-cols-[minmax(0,1fr)_26px]'
      },
      false: {
        header: 'grid-cols-[minmax(0,1fr)]'
      }
    }
  }
}

export type PanelSectionTheme = typeof panelSectionTheme
export default panelSectionTheme
