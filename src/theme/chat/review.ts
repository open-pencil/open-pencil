/**
 * A design review in the transcript: a card across the column, set apart from replies, with its
 * findings and the action that sends them on.
 */
export default {
  slots: {
    root: 'flex flex-col gap-2 rounded-lg border border-border px-3 py-2.5',
    header: 'flex items-center gap-1.5 text-2xs font-medium text-muted',
    icon: 'size-3 shrink-0',
    focus: 'text-2xs leading-snug text-muted',
    findings: 'text-xs leading-relaxed',
    actions: 'flex justify-end'
  }
} as const
