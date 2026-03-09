import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const surface = tv({
  base: 'border border-border bg-panel',
  variants: {
    elevation: {
      md: 'shadow-md',
      lg: 'shadow-lg',
      xl: 'shadow-xl',
      overlay: 'shadow-[0_8px_30px_rgb(0_0_0/0.4)]'
    },
    radius: {
      md: 'rounded-md',
      lg: 'rounded-lg',
      xl: 'rounded-xl'
    },
    padding: {
      none: '',
      sm: 'p-1',
      md: 'p-2',
      lg: 'p-3'
    }
  },
  defaultVariants: {
    elevation: 'lg',
    radius: 'lg',
    padding: 'sm'
  }
})

export function panelSurface(options?: {
  elevation?: 'md' | 'lg' | 'xl' | 'overlay'
  radius?: 'md' | 'lg' | 'xl'
  padding?: 'none' | 'sm' | 'md' | 'lg'
  class?: string
}) {
  return twMerge(surface(options), options?.class)
}
