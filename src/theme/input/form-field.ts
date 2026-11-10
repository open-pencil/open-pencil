/** A labelled form control with its error or hint underneath. */
export default {
  slots: {
    root: 'flex flex-col gap-1.5',
    labelRow: 'flex items-center justify-between',
    label: 'font-medium data-[hidden=true]:sr-only',
    hint: 'text-muted',
    error: 'text-error'
  },
  variants: {
    size: {
      /** Dialogs and panels. */
      md: { label: 'text-2xs text-muted', hint: 'text-2xs', error: 'text-2xs' },
      /** A Cloud server's own sign-in pages. */
      lg: { label: 'text-sm text-surface', hint: 'text-xs', error: 'text-xs' }
    }
  },
  defaultVariants: { size: 'md' as const }
}
