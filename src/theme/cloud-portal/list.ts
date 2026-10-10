import { tv } from 'tailwind-variants'

/** Console lists, drawn like the home tab's list view. */
export const portalList = tv({
  slots: {
    toolbar: 'flex flex-wrap items-center gap-2',
    list: 'overflow-hidden rounded-lg border border-border bg-panel',
    row: 'flex min-h-14 items-center gap-3 border-b border-border px-4 py-2.5 last:border-b-0',
    body: 'min-w-0 flex-1',
    title: 'flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-surface',
    detail: 'mt-0.5 truncate text-[11px] text-muted',
    quote: 'mt-1 line-clamp-2 text-[11px] text-surface',
    meta: 'hidden shrink-0 text-[11px] text-muted tabular-nums sm:block',
    actions: 'flex shrink-0 items-center gap-1',
    status:
      'shrink-0 rounded px-1.5 py-px text-[10px] font-medium data-[tone=neutral]:bg-panel-field data-[tone=neutral]:text-muted data-[tone=success]:bg-success/10 data-[tone=success]:text-success data-[tone=warning]:bg-warning-bg data-[tone=warning]:text-warning-text data-[tone=error]:bg-error-bg data-[tone=error]:text-error'
  }
})
