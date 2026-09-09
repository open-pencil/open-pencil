const segmentedControlTheme = {
  slots: {
    root: 'inline-flex items-center gap-0.5 rounded bg-panel-field p-0.5 hover:bg-panel-field-hover',
    item: 'flex h-[22px] min-w-max flex-auto cursor-pointer items-center justify-center gap-1 rounded-sm text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-1 focus-visible:ring-panel-focus data-[state=on]:bg-hover data-[state=on]:text-surface data-[state=on]:hover:bg-hover disabled:cursor-not-allowed disabled:opacity-50'
  },
  variants: {
    size: {
      sm: { item: 'px-1.5 text-[11px]' },
      md: { item: 'px-2 text-[11px]' },
      touch: { item: 'h-10 min-w-10 px-2 text-xs' }
    }
  },
  defaultVariants: {
    size: 'sm' as const
  }
}

export type SegmentedControlTheme = typeof segmentedControlTheme
export default segmentedControlTheme
