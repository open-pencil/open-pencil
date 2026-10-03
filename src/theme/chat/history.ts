import { tv } from 'tailwind-variants'

import { motionStyles } from '../motion/styles'

export const chatHistoryTheme = tv({
  slots: {
    root: 'shrink-0 border-b border-border',
    header: 'flex min-w-0 items-center gap-1 px-2 py-1.5',
    trigger:
      'flex min-w-0 flex-1 items-center gap-1 rounded px-1.5 py-1 text-left text-xs text-surface hover:bg-hover disabled:opacity-50',
    title: 'min-w-0 flex-1 truncate',
    icon: 'size-3.5 shrink-0',
    content: [
      'z-50 w-80 max-w-[calc(100vw-1rem)] rounded-lg border border-border bg-panel p-2 text-surface shadow-lg',
      motionStyles.floating
    ],
    input:
      'w-full rounded border border-border bg-input px-2 py-1.5 text-xs outline-none focus:border-accent',
    scope: 'my-2 flex gap-1',
    scopeButton:
      'flex-1 rounded px-2 py-1 text-[11px] text-muted hover:bg-hover data-[active=true]:bg-hover data-[active=true]:text-surface',
    list: 'max-h-64 space-y-0.5 overflow-y-auto',
    row: 'flex w-full items-center gap-2 rounded px-2 py-2 text-left hover:bg-hover focus-visible:outline-accent data-[selected=true]:bg-hover',
    detail: 'block truncate text-[10px] text-muted',
    label: 'block truncate text-xs',
    empty: 'px-2 py-4 text-center text-xs text-muted',
    form: 'space-y-2 border-t border-border p-2',
    actions: 'flex justify-end gap-1',
    confirmation: 'text-xs text-surface'
  }
})
