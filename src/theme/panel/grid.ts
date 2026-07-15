const panelGridTheme = {
  base: 'grid min-w-0 items-end gap-panel',
  variants: {
    columns: {
      two: 'grid-cols-2',
      'two-rail': 'grid-cols-[minmax(0,1fr)_minmax(0,1fr)_var(--spacing-panel-rail)]',
      fill: 'grid-cols-[minmax(0,1fr)]',
      'fill-rail': 'grid-cols-[minmax(0,1fr)_var(--spacing-panel-rail)]'
    }
  },
  defaultVariants: {
    columns: 'two-rail' as const
  }
}

export type PanelGridTheme = typeof panelGridTheme
export default panelGridTheme
