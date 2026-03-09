import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const trigger = tv({
  base: 'flex items-center justify-between border border-border bg-input text-surface outline-none hover:bg-hover'
})

const content = tv({
  base: 'z-50 min-w-[var(--reka-select-trigger-width)] overflow-hidden border border-border bg-panel',
  variants: {
    radius: {
      md: 'rounded-md',
      lg: 'rounded-lg'
    },
    elevation: {
      lg: 'shadow-lg',
      xl: 'shadow-xl'
    },
    padding: {
      none: '',
      sm: 'p-0.5',
      md: 'p-1'
    }
  },
  defaultVariants: {
    radius: 'md',
    elevation: 'lg',
    padding: 'sm'
  }
})

const item = tv({
  base: 'relative flex cursor-pointer items-center text-surface outline-none data-[highlighted]:bg-hover'
})

export function selectTrigger(options?: { class?: string }) {
  return twMerge(trigger(), options?.class)
}

export function selectContent(options?: {
  radius?: 'md' | 'lg'
  elevation?: 'lg' | 'xl'
  padding?: 'none' | 'sm' | 'md'
  class?: string
}) {
  return twMerge(content(options), options?.class)
}

export function selectItem(options?: { class?: string }) {
  return twMerge(item(), options?.class)
}
