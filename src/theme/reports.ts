/** The report dialog: its fields, and the body it shows before sending. */
export default {
  slots: {
    body: 'flex flex-col gap-3',
    field: 'flex flex-col gap-1.5',
    label: 'text-2xs font-medium text-muted',
    hint: 'text-2xs text-muted',
    preview:
      'scrollbar-thin max-h-64 overflow-auto rounded-md border border-border bg-input p-2 font-mono text-3xs whitespace-pre-wrap text-surface'
  }
} as const
