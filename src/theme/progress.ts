const progressTheme = {
  slots: {
    root: 'relative w-full overflow-hidden rounded-full bg-hover',
    indicator:
      'size-full origin-left rounded-full transition-transform duration-200 ease-out motion-reduce:transition-none'
  },
  variants: {
    size: {
      sm: { root: 'h-1' },
      md: { root: 'h-1.5' }
    },
    tone: {
      accent: { indicator: 'bg-accent' },
      muted: { indicator: 'bg-muted' },
      warning: { indicator: 'bg-warning' },
      danger: { indicator: 'bg-danger' }
    }
  },
  defaultVariants: {
    size: 'sm',
    tone: 'accent'
  }
} as const

export type ProgressTheme = typeof progressTheme
export default progressTheme
