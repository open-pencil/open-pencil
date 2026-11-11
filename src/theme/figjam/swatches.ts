import { focusStyles } from '../focus/styles'

const swatchesTheme = {
  slots: {
    root: 'grid grid-cols-11 justify-items-center gap-0.75',
    // The chosen swatch is ringed in the accent, so focus is an outline clear of that ring.
    swatch: ['size-4 cursor-pointer rounded-full border border-border', focusStyles.outline],
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
