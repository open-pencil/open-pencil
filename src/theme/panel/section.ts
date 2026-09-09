const panelSectionTheme = {
  slots: {
    root: 'border-b border-border px-3 pb-3 text-surface data-[disabled]:opacity-60',
    header: 'flex h-8 min-w-0 items-center gap-1.5',
    title:
      'min-w-0 flex-1 cursor-default truncate border-0 bg-transparent p-0 text-left text-[11px] font-semibold text-surface',
    actions:
      'flex h-7 w-[26px] shrink-0 items-center justify-end gap-0.5 [&_[data-slot=icon-button]]:size-6 [&_[data-slot=icon-button]]:rounded',
    body: 'min-w-0 data-[state=closed]:hidden'
  }
}

export type PanelSectionTheme = typeof panelSectionTheme
export default panelSectionTheme
