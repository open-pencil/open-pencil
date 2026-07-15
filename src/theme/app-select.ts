import selectTheme from './select'

const appSelectTheme = {
  slots: {
    ...selectTheme.slots,
    trigger: [selectTheme.slots.trigger, 'w-full min-w-0 px-1.5 text-xs'],
    value: [selectTheme.slots.value, 'min-w-0 flex-1 truncate text-left'],
    content: [selectTheme.slots.content, 'max-h-56'],
    viewport: [selectTheme.slots.viewport, 'p-0.5'],
    item: [selectTheme.slots.item, 'rounded py-1.5 pr-2 pl-6 text-xs'],
    indicator: 'absolute left-1.5 inline-flex items-center justify-center'
  },
  variants: selectTheme.variants,
  defaultVariants: selectTheme.defaultVariants
}

export type AppSelectTheme = typeof appSelectTheme
export default appSelectTheme
