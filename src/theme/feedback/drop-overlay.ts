/**
 * The outline over a surface that files are dragged onto. Over the canvas it is a light tint, so
 * the drop point stays visible; over a field, such as the chat composer, it covers the content so
 * the label reads on its own.
 */
const dropOverlayTheme = {
  slots: {
    root: 'pointer-events-none absolute inset-0 z-40 flex items-center justify-center border-2 border-dashed',
    label: 'flex items-center gap-1.5 text-xs font-medium'
  },
  variants: {
    accepts: {
      true: { root: 'border-accent/60 bg-accent/5', label: 'text-accent' },
      false: { root: 'border-border bg-panel/70', label: 'text-muted' }
    },
    // After `accepts`, so a field's own fill replaces the tint.
    shape: {
      surface: { label: 'rounded-md bg-panel px-2 py-1 shadow-sm' },
      field: { root: 'rounded-xl bg-input/95' }
    }
  },
  defaultVariants: { shape: 'surface' as const, accepts: true }
} as const

export default dropOverlayTheme
