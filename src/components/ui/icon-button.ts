import { tv } from 'tailwind-variants'

export const iconButton = tv({
  base: 'flex cursor-pointer items-center justify-center rounded border-none bg-transparent text-muted hover:bg-hover hover:text-surface',
  variants: {
    size: {
      sm: 'size-5 text-sm leading-none',
      md: 'size-7 border border-border bg-input'
    }
  },
  defaultVariants: { size: 'sm' }
})
