import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

const input = tv({
  base: 'w-full rounded border border-border bg-input text-surface outline-none focus:border-accent',
  variants: {
    size: {
      sm: 'px-2 py-1 text-[11px]',
      md: 'px-2 py-1 text-xs'
    }
  },
  defaultVariants: {
    size: 'md'
  }
})

export function uiInput(options?: { size?: 'sm' | 'md'; class?: string }) {
  return twMerge(input(options), options?.class)
}
