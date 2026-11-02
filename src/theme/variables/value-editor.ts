/** A value editor: its label with its tools, then its field and what belongs to it. */
export default {
  slots: {
    root: 'flex flex-col gap-1',
    header: 'flex min-h-6 items-center justify-between gap-2',
    label: 'text-[11px] text-muted',
    tools: 'flex shrink-0 items-center',
    control: 'flex min-h-7 min-w-0 items-center gap-1.5',
    error: 'text-[10px] text-error'
  },
  variants: {
    /** A single value heads its section; one of several modes is labelled with the mode. */
    heading: {
      section: { label: 'font-semibold' },
      mode: {}
    }
  },
  defaultVariants: { heading: 'mode' }
} as const
