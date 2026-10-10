import { tv } from 'tailwind-variants'

/** The document an invitation opens, shown before anyone signs in or accepts. */
export const cloudInvitation = tv({
  slots: {
    document: 'flex items-center gap-3 rounded-lg border border-border bg-panel-field px-3 py-3',
    documentIcon: 'flex size-9 shrink-0 items-center justify-center rounded-md bg-panel text-muted',
    documentBody: 'min-w-0 flex-1',
    documentName: 'block truncate text-xs font-medium text-surface',
    documentMeta: 'mt-0.5 block truncate text-[11px] text-muted',
    permission: 'shrink-0 rounded bg-panel px-1.5 py-0.5 text-[10px] font-medium text-muted',
    stack: 'flex flex-col gap-3',
    desktop: 'me-auto',
    unavailable: 'flex flex-col items-center gap-3 py-4 text-center',
    unavailableIcon:
      'flex size-10 items-center justify-center rounded-full bg-panel-field text-muted',
    unavailableDescription: 'max-w-xs text-[11px] leading-relaxed text-muted',
    loading: 'flex items-center justify-center gap-2 py-6 text-[11px] text-muted',
    spinner: 'size-3.5 shrink-0 animate-spin motion-reduce:animate-none'
  }
})
