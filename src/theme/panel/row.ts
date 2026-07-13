const panelRowTheme = {
  base: 'flex items-center',
  variants: {
    columns: {
      auto: '',
      two: '[&>*]:min-w-0 [&>*]:flex-1',
      fill: '[&>*:first-child]:min-w-0 [&>*:first-child]:flex-1'
    },
    gap: {
      sm: 'gap-0.5',
      md: 'gap-panel'
    }
  },
  defaultVariants: {
    columns: 'auto' as const,
    gap: 'md' as const
  }
}

export type PanelRowTheme = typeof panelRowTheme
export default panelRowTheme
