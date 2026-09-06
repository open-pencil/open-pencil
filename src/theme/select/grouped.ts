import selectTheme from './select'

const appGroupedSelectTheme = {
  slots: {
    ...selectTheme.slots,
    trigger: [selectTheme.slots.trigger, 'w-full justify-between px-2 text-[11px] text-surface'],
    content: [selectTheme.slots.content, 'isolate z-[52]'],
    item: [selectTheme.slots.item, 'rounded px-2 py-1 text-[11px]'],
    label: 'px-2 py-1 text-[10px] text-muted',
    separator: 'mx-1 my-1 h-px bg-border'
  },
  variants: selectTheme.variants,
  defaultVariants: {
    radius: 'lg' as const,
    elevation: 'lg' as const,
    padding: 'md' as const
  }
}

export type AppGroupedSelectTheme = typeof appGroupedSelectTheme
export default appGroupedSelectTheme
