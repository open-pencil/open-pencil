const statusTheme = {
  slots: {
    text: 'text-[10px] leading-snug'
  },
  variants: {
    tone: {
      neutral: { text: 'text-muted' },
      success: { text: 'text-[var(--color-success)]' },
      warning: { text: 'text-[var(--color-warning-text)]' },
      error: { text: 'text-[var(--color-error)]' }
    }
  },
  defaultVariants: {
    tone: 'neutral' as const
  }
}

export type StatusTheme = typeof statusTheme
export default statusTheme
