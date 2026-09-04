import { panelFieldBase } from './form'

export const selectTheme = {
  slots: {
    trigger: [
      panelFieldBase,
      'flex w-full min-w-0 cursor-pointer items-center justify-between px-2 text-xs'
    ],
    value: 'min-w-0 flex-1 truncate text-left',
    content:
      'z-[110] min-w-[var(--reka-select-trigger-width)] overflow-hidden rounded-md border border-border bg-panel text-xs shadow-xl',
    viewport: 'p-1',
    item:
      'relative flex h-7 cursor-pointer items-center rounded px-2 pr-7 text-surface outline-none select-none data-[disabled]:pointer-events-none data-[highlighted]:bg-hover data-[disabled]:opacity-50',
    indicator: 'absolute right-2 inline-flex items-center justify-center'
  }
} as const

export type SelectTheme = typeof selectTheme
