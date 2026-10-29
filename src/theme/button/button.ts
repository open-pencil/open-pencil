export default {
  slots: {
    base: [
      'inline-flex items-center justify-center gap-1.5 font-medium whitespace-nowrap select-none transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
      'disabled:cursor-not-allowed disabled:opacity-50'
    ],
    icon: 'size-3.5 shrink-0'
  },
  variants: {
    color: {
      neutral: {},
      primary: {},
      error: {}
    },
    variant: {
      solid: {},
      outline: {},
      soft: {},
      subtle: {},
      ghost: {},
      link: {}
    },
    size: {
      xs: { base: 'h-6 px-1.5 text-[10px]', icon: 'size-3' },
      sm: { base: 'h-7 px-2 text-xs' },
      md: { base: 'h-8 px-3 text-xs' },
      lg: { base: 'h-9 px-3.5 text-sm' }
    },
    shape: {
      square: { base: 'rounded' },
      rounded: { base: 'rounded-md' },
      pill: { base: 'rounded-full' }
    }
  },
  compoundVariants: [
    {
      color: 'neutral',
      variant: 'solid',
      class: { base: 'bg-surface text-panel hover:bg-surface/90' }
    } as const,
    {
      color: 'neutral',
      variant: 'outline',
      class: { base: 'border border-border text-surface hover:bg-hover' }
    } as const,
    {
      color: 'neutral',
      variant: 'soft',
      class: { base: 'bg-hover text-surface hover:bg-hover/80' }
    } as const,
    {
      color: 'neutral',
      variant: 'subtle',
      class: { base: 'border border-border/60 text-muted hover:bg-hover hover:text-surface' }
    } as const,
    {
      color: 'neutral',
      variant: 'ghost',
      class: { base: 'text-muted hover:bg-hover hover:text-surface' }
    } as const,
    {
      color: 'neutral',
      variant: 'link',
      class: { base: 'text-muted hover:text-surface hover:underline' }
    } as const,
    {
      color: 'primary',
      variant: 'solid',
      class: { base: 'bg-primary text-on-primary hover:bg-primary/90' }
    } as const,
    {
      color: 'primary',
      variant: 'outline',
      class: { base: 'border border-primary/50 text-primary hover:bg-primary/10' }
    } as const,
    {
      color: 'primary',
      variant: 'soft',
      class: { base: 'bg-primary/10 text-primary hover:bg-primary/15' }
    } as const,
    {
      color: 'primary',
      variant: 'subtle',
      class: { base: 'border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15' }
    } as const,
    {
      color: 'primary',
      variant: 'ghost',
      class: { base: 'text-primary hover:bg-primary/10' }
    } as const,
    { color: 'primary', variant: 'link', class: { base: 'text-primary hover:underline' } } as const,
    {
      color: 'error',
      variant: 'solid',
      class: { base: 'bg-error text-inverted hover:bg-error/90' }
    } as const,
    {
      color: 'error',
      variant: 'outline',
      class: { base: 'border border-error/50 text-error hover:bg-error/10' }
    } as const,
    {
      color: 'error',
      variant: 'soft',
      class: { base: 'bg-error/10 text-error hover:bg-error/15' }
    } as const,
    {
      color: 'error',
      variant: 'subtle',
      class: { base: 'border border-error/25 bg-error/10 text-error hover:bg-error/15' }
    } as const,
    { color: 'error', variant: 'ghost', class: { base: 'text-error hover:bg-error/10' } } as const,
    { color: 'error', variant: 'link', class: { base: 'text-error hover:underline' } } as const
  ],
  defaultVariants: { color: 'neutral', variant: 'ghost', size: 'sm', shape: 'rounded' } as const
}
