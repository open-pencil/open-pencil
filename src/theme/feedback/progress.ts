const progressTheme = {
  slots: {
    root: 'flex min-w-0 flex-col gap-1',
    track: 'h-1 w-full overflow-hidden rounded-full',
    // Reka marks unmeasurable work `indeterminate`; the bar then pulses in place.
    fill: 'h-full rounded-full transition-[width] duration-150 ease-out motion-reduce:transition-none data-[state=indeterminate]:w-1/3 data-[state=indeterminate]:animate-pulse motion-reduce:data-[state=indeterminate]:animate-none',
    label: 'text-[10px] leading-none tabular-nums'
  },
  variants: {
    tone: {
      /** On panels: an accent bar on a quiet track. */
      accent: { track: 'bg-hover', fill: 'bg-accent', label: 'text-muted' },
      /** On coloured surfaces such as toasts: follows the text colour. */
      current: { track: 'bg-current/25', fill: 'bg-current', label: '' }
    }
  },
  defaultVariants: { tone: 'accent' as const }
} as const

export default progressTheme
