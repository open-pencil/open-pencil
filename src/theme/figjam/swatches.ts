const swatchesTheme = {
  slots: {
    root: 'grid grid-cols-11 justify-items-center gap-[3px]',
    swatch:
      'size-4 cursor-pointer rounded-full border border-border focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none',
    none: 'flex items-center justify-center bg-transparent text-muted'
  },
  variants: {
    active: {
      true: { swatch: 'ring-2 ring-accent ring-offset-1 ring-offset-panel' },
      false: { swatch: 'hover:border-muted' }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type SwatchesTheme = typeof swatchesTheme
export default swatchesTheme
