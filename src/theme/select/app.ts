import selectTheme from './select'

const appSelectTheme = {
  slots: {
    ...selectTheme.slots,
    trigger: [selectTheme.slots.trigger, 'w-full min-w-0 px-1.5']
  },
  variants: selectTheme.variants,
  defaultVariants: selectTheme.defaultVariants
}

export type AppSelectTheme = typeof appSelectTheme
export default appSelectTheme
