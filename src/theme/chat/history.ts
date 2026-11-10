import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

export default {
  slots: {
    root: 'shrink-0 border-b border-border',
    header: 'flex min-w-0 items-center gap-1 px-2 py-1.5',
    heading: 'min-w-0 flex-1 truncate px-1 text-xs text-surface',
    title: 'min-w-0 flex-1 truncate',
    icon: 'size-3.5 shrink-0',
    content: ['z-50 w-80 max-w-[calc(100vw-1rem)] p-2', floatingSurface, motionStyles.floating],
    input:
      'w-full rounded border border-border bg-input px-2 py-1.5 text-xs outline-none focus:border-panel-focus',
    scope: 'my-2 flex gap-1',
    scopeButton:
      'flex-1 rounded px-2 py-1 text-2xs text-muted hover:bg-hover data-[active=true]:bg-hover data-[active=true]:text-surface',
    list: 'max-h-64 space-y-0.5 overflow-y-auto',
    row: 'flex w-full items-center gap-2 rounded px-2 py-2 text-start hover:bg-hover focus-visible:outline-panel-focus data-[selected=true]:bg-hover',
    detail: 'block truncate text-3xs text-muted',
    label: 'block truncate text-xs',
    empty: 'px-2 py-4 text-center text-xs text-muted',
    form: 'space-y-2 border-t border-border p-2',
    actions: 'flex justify-end gap-1'
  }
} as const
