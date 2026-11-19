const statusTheme = {
  slots: {
    text: 'text-3xs leading-snug',
    /** A state as a coloured dot and its label, as room status shows it. */
    indicator: 'inline-flex items-center gap-1.5 text-xs',
    dot: 'size-2 shrink-0 rounded-full'
  },
  variants: {
    tone: {
      neutral: { text: 'text-muted', indicator: 'text-surface', dot: 'bg-muted' },
      pending: {
        text: 'text-muted',
        indicator: 'text-surface',
        dot: 'animate-pulse bg-muted motion-reduce:animate-none'
      },
      success: {
        text: 'text-success',
        indicator: 'text-surface',
        dot: 'bg-success'
      },
      warning: {
        text: 'text-warning',
        indicator: 'text-warning',
        dot: 'bg-warning'
      },
      error: {
        text: 'text-error',
        indicator: 'text-error',
        dot: 'bg-error'
      }
    }
  },
  defaultVariants: {
    tone: 'neutral' as const
  }
}

export type StatusTheme = typeof statusTheme
export type StatusTone = keyof typeof statusTheme.variants.tone
export default statusTheme
