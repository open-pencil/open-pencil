import { focusStyles } from '../focus/styles'

const swatchesTheme = {
  slots: {
    root: 'grid grid-cols-11 justify-items-center gap-0.75',
    // One ring around a swatch: the chosen one's in the text colour, turning the focus colour while
    // focused, as the accent swatches in Settings do.
    swatch: [
      'size-4 cursor-pointer rounded-full border border-border ring-offset-1 ring-offset-panel',
      focusStyles.ringStrong
    ],
    none: 'flex items-center justify-center bg-transparent text-muted'
  },
  variants: {
    active: {
      true: { swatch: 'ring-2 not-focus-visible:ring-surface' },
      false: { swatch: 'hover:border-muted' }
    }
  },
  defaultVariants: {
    active: false
  }
}

export type SwatchesTheme = typeof swatchesTheme
export default swatchesTheme
