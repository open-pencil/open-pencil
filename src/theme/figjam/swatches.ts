import { focusStyles } from '../focus/styles'

const swatchesTheme = {
  slots: {
    // Far enough apart that a focused swatch's outline stays clear of its neighbours; eleven to a
    // row at most, wrapping where the panel or the window is narrower.
    root: 'flex max-w-64 flex-wrap gap-2',
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
