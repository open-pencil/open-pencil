import { tv } from 'tailwind-variants'

export const fillSwatchTrigger = tv({
  slots: {
    root: 'shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 disabled:cursor-not-allowed disabled:opacity-50',
    swatch: 'size-full',
    preview: 'pointer-events-none absolute inset-0'
  },
  variants: { size: { sm: { root: 'size-4' }, md: { root: 'size-5' } } },
  defaultVariants: { size: 'sm' }
})
