import { panelFieldBase } from './panel/field'

const appComboboxTheme = {
  slots: {
    trigger: [panelFieldBase, 'flex w-full min-w-0 items-center justify-between px-2'],
    value: 'min-w-0 flex-1 truncate text-left text-[11px] text-surface',
    chevron: 'ml-1 size-3 shrink-0 text-muted',
    content:
      'z-[110] max-h-72 min-w-[var(--reka-combobox-trigger-width)] overflow-hidden rounded-md bg-panel text-[11px] shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
    search: 'relative m-1 flex h-7 items-center rounded-md border border-border bg-input',
    input:
      'h-full min-w-0 flex-1 bg-transparent pr-2 pl-7 text-[11px] text-surface outline-none placeholder:text-muted',
    searchIcon: 'pointer-events-none absolute left-2 size-3 text-muted',
    viewport: 'max-h-64 overflow-y-auto p-0.5',
    empty: 'px-2 py-4 text-center text-[11px] text-muted',
    groupLabel:
      'sticky top-0 z-10 bg-panel px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-muted',
    item: 'relative flex min-h-8 cursor-pointer items-center gap-2 rounded py-1 pr-2 pl-6 text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50',
    indicator: 'absolute left-1.5 inline-flex items-center justify-center',
    description: 'truncate font-mono text-[9px] text-muted',
    meta: 'shrink-0 rounded bg-accent/10 px-1 py-px text-[9px] text-accent'
  }
}

export type AppComboboxTheme = typeof appComboboxTheme
export default appComboboxTheme
