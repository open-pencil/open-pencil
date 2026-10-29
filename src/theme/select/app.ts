import selectTheme from './select'

const appSelectTheme = {
  slots: {
    ...selectTheme.slots,
    trigger: [selectTheme.slots.trigger, 'w-full min-w-0']
  },
  variants: {
    ...selectTheme.variants,
    /** The control scale in `theme/control.ts`, with the padding and text of an input that size. */
    size: {
      xs: { trigger: 'h-6 px-1.5 text-[11px]' },
      sm: { trigger: 'h-7 px-2.5 text-xs' },
      md: { trigger: 'h-8 px-3 text-xs' },
      lg: { trigger: 'h-9 px-3 text-sm' }
    }
  },
  defaultVariants: { ...selectTheme.defaultVariants, size: 'xs' as const }
}

export type AppSelectTheme = typeof appSelectTheme
export default appSelectTheme
