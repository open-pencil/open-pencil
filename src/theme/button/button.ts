import { tv } from 'tailwind-variants'

const appButton = tv({
  slots: {
    base: [
      'inline-flex items-center justify-center gap-1.5 font-medium select-none transition-colors',
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
    },
    {
      color: 'neutral',
      variant: 'outline',
      class: { base: 'border border-border text-surface hover:bg-hover' }
    },
    {
      color: 'neutral',
      variant: 'soft',
      class: { base: 'bg-hover text-surface hover:bg-hover/80' }
    },
    {
      color: 'neutral',
      variant: 'subtle',
      class: { base: 'border border-border/60 text-muted hover:bg-hover hover:text-surface' }
    },
    {
      color: 'neutral',
      variant: 'ghost',
      class: { base: 'text-muted hover:bg-hover hover:text-surface' }
    },
    {
      color: 'neutral',
      variant: 'link',
      class: { base: 'text-muted hover:text-surface hover:underline' }
    },
    {
      color: 'primary',
      variant: 'solid',
      class: { base: 'bg-accent text-white hover:bg-accent/90' }
    },
    {
      color: 'primary',
      variant: 'outline',
      class: { base: 'border border-accent/50 text-accent hover:bg-accent/10' }
    },
    {
      color: 'primary',
      variant: 'soft',
      class: { base: 'bg-accent/15 text-accent hover:bg-accent/20' }
    },
    { color: 'primary', variant: 'subtle', class: { base: 'text-accent hover:bg-accent/10' } },
    { color: 'primary', variant: 'ghost', class: { base: 'text-accent hover:bg-accent/10' } },
    { color: 'primary', variant: 'link', class: { base: 'text-accent hover:underline' } },
    {
      color: 'error',
      variant: 'solid',
      class: { base: 'bg-red-500 text-white hover:bg-red-500/90' }
    },
    {
      color: 'error',
      variant: 'outline',
      class: { base: 'border border-red-400/50 text-red-400 hover:bg-red-500/10' }
    },
    {
      color: 'error',
      variant: 'soft',
      class: { base: 'bg-red-500/15 text-red-400 hover:bg-red-500/20' }
    },
    { color: 'error', variant: 'subtle', class: { base: 'text-red-400 hover:bg-red-500/10' } },
    { color: 'error', variant: 'ghost', class: { base: 'text-red-400 hover:bg-red-500/10' } },
    { color: 'error', variant: 'link', class: { base: 'text-red-400 hover:underline' } }
  ],
  defaultVariants: { color: 'neutral', variant: 'ghost', size: 'sm', shape: 'rounded' }
})

export type AppButtonColor = 'neutral' | 'primary' | 'error'
export type AppButtonVariant = 'solid' | 'outline' | 'soft' | 'subtle' | 'ghost' | 'link'
export type AppButtonSize = 'xs' | 'sm' | 'md' | 'lg'
export type AppButtonShape = 'square' | 'rounded' | 'pill'

export function useAppButtonUI(options?: {
  color?: AppButtonColor
  variant?: AppButtonVariant
  size?: AppButtonSize
  shape?: AppButtonShape
  ui?: { base?: string; icon?: string }
}) {
  const styles = appButton(options)
  return {
    base: styles.base({ class: options?.ui?.base }),
    icon: styles.icon({ class: options?.ui?.icon })
  }
}
