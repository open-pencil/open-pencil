import { tv } from 'tailwind-variants'

export const cloudStatus = tv({
  slots: {
    trigger:
      'flex h-6 shrink-0 items-center gap-1 rounded px-1 text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent/50 data-[state=open]:bg-hover data-[state-sync=conflict]:bg-warning-bg data-[state-sync=conflict]:text-warning-text data-[state-sync=error]:text-error data-[state-sync=view]:bg-panel-field data-[state-sync=view]:text-surface',
    triggerLabel: 'text-[11px] font-medium',
    header: 'flex items-start gap-2.5',
    headerIcon:
      'flex size-8 shrink-0 items-center justify-center rounded-md bg-panel-field text-muted data-[state-sync=synced]:text-primary data-[state-sync=conflict]:bg-warning-bg data-[state-sync=conflict]:text-warning-text data-[state-sync=error]:bg-error-bg data-[state-sync=error]:text-error',
    title: 'text-xs font-medium text-surface',
    detail: 'mt-0.5 text-[11px] leading-relaxed text-muted',
    facts: 'mt-3 flex flex-col gap-1 rounded-md bg-panel-field px-2.5 py-2 text-[11px]',
    fact: 'flex justify-between gap-3 [&_dt]:text-muted [&_dd]:truncate [&_dd]:text-surface',
    actions: 'mt-3 flex flex-wrap items-center gap-2'
  }
})
