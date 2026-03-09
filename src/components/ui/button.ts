import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const button = tv({
  base: 'inline-flex items-center justify-center transition-colors select-none',
  variants: {
    tone: {
      ghost: 'bg-transparent text-muted hover:bg-hover hover:text-surface',
      accent: 'bg-accent text-white hover:bg-accent/90',
      panel: 'bg-panel/70 text-surface backdrop-blur-xl',
      panelAccent: 'bg-panel/70 text-accent border-accent/20 backdrop-blur-xl'
    },
    shape: {
      square: 'rounded',
      rounded: 'rounded-md',
      pill: 'rounded-full'
    },
    size: {
      sm: 'h-7 px-2 text-xs',
      md: 'h-8 px-3 text-xs',
      icon: 'size-8',
      iconSm: 'size-7'
    },
    bordered: {
      true: 'border border-white/10',
      false: ''
    }
  },
  compoundVariants: [
    { tone: 'accent', size: 'icon', class: 'px-0' },
    { tone: 'ghost', size: 'icon', class: 'px-0' },
    { tone: 'panel', size: 'icon', class: 'shadow-md' },
    { tone: 'panel', size: 'iconSm', class: 'shadow-sm' },
    { tone: 'panelAccent', size: 'icon', class: 'shadow-md' },
    { tone: 'panel', bordered: true, class: 'border border-white/10' },
    { tone: 'panelAccent', bordered: true, class: 'border' }
  ],
  defaultVariants: {
    tone: 'ghost',
    shape: 'rounded',
    size: 'sm',
    bordered: false
  }
})

export function uiButton(options?: {
  tone?: 'ghost' | 'accent' | 'panel' | 'panelAccent'
  shape?: 'square' | 'rounded' | 'pill'
  size?: 'sm' | 'md' | 'icon' | 'iconSm'
  bordered?: boolean
  class?: string
}) {
  return twMerge(button(options), options?.class)
}
