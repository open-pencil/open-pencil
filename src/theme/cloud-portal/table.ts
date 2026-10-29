/** What console tables put in their cells and above them. */
export default {
  slots: {
    toolbar: 'flex flex-wrap items-center gap-2',
    title: 'flex min-w-0 items-center gap-1.5 truncate text-xs font-medium text-surface',
    detail: 'mt-0.5 truncate text-[11px] text-muted',
    quote: 'line-clamp-2 text-[11px] text-surface',
    actions: 'flex items-center justify-end gap-1',
    status:
      'inline-block shrink-0 rounded px-1.5 py-px text-[10px] font-medium whitespace-nowrap data-[tone=neutral]:bg-panel-field data-[tone=neutral]:text-muted data-[tone=success]:bg-success/10 data-[tone=success]:text-success data-[tone=warning]:bg-warning-bg data-[tone=warning]:text-warning data-[tone=error]:bg-error-bg data-[tone=error]:text-error'
  }
} as const
