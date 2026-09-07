import { tv } from 'tailwind-variants'

export const actionRow = tv({
  slots: {
    root: 'group flex w-full items-center gap-3 rounded border border-border bg-panel-field px-3 py-2 text-left whitespace-normal transition-colors hover:border-panel-focus hover:bg-panel-field-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50',
    leading: 'flex shrink-0 items-center justify-center text-muted',
    body: 'min-w-0 flex-1',
    label: 'block truncate text-[11px] font-medium text-surface',
    description: 'block text-[10px] break-words text-muted',
    trailing: 'flex shrink-0 items-center gap-1 text-muted'
  }
})
