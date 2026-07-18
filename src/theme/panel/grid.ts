const panelGridTheme = {
  base: 'grid min-w-0 items-end gap-1.5',
  variants: {
    columns: {
      two: 'grid-cols-2',
      three: 'grid-cols-3',
      appearance: 'grid-cols-[minmax(0,7fr)_minmax(0,5fr)]',
      'two-rail': 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_26px]',
      fill: 'grid-cols-[minmax(0,1fr)]',
      'fill-rail': 'grid-cols-[minmax(0,1fr)_26px]'
    }
  },
  defaultVariants: {
    columns: 'two-rail' as const
  }
}

export type PanelGridTheme = typeof panelGridTheme
export default panelGridTheme
