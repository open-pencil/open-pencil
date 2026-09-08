import { tv } from 'tailwind-variants'

export const panelFieldBase =
  'h-8 min-w-0 rounded-md border border-border bg-panel-field text-surface outline-none hover:bg-panel-field-hover focus:border-panel-focus focus-visible:border-panel-focus disabled:cursor-not-allowed disabled:text-muted disabled:opacity-60'

export const inputTheme = tv({
  base: [
    'min-w-0 w-full rounded-md border border-border bg-input text-surface outline-none',
    'placeholder:text-muted hover:border-muted/60',
    'focus:border-panel-focus focus:ring-1 focus:ring-accent/25',
    'disabled:cursor-not-allowed disabled:opacity-60'
  ],
  variants: {
    size: {
      xs: 'h-6 px-2 text-[11px]',
      sm: 'h-7 px-2.5 text-xs',
      md: 'h-8 px-3 text-xs',
      lg: 'h-9 px-3 text-sm'
    },
    invalid: {
      true: 'border-error focus:border-error focus:ring-error/25',
      false: ''
    }
  },
  defaultVariants: { size: 'md', invalid: false }
})

export type InputSize = 'xs' | 'sm' | 'md' | 'lg'

export const textareaTheme = tv({
  base: [
    'min-w-0 w-full resize-y rounded-md border border-border bg-input px-3 py-2 text-surface outline-none',
    'placeholder:text-muted hover:border-muted/60',
    'focus:border-panel-focus focus:ring-1 focus:ring-accent/25',
    'disabled:cursor-not-allowed disabled:opacity-60'
  ],
  variants: {
    size: {
      sm: 'text-xs leading-relaxed',
      md: 'text-sm leading-6'
    },
    invalid: {
      true: 'border-error focus:border-error focus:ring-error/25',
      false: ''
    }
  },
  defaultVariants: { size: 'sm', invalid: false }
})

export type TextareaSize = 'sm' | 'md'
