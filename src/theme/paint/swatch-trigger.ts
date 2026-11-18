import { focusStyles } from '../focus/styles'

export default {
  slots: {
    root: [
      'shrink-0 cursor-pointer rounded-sm border-0 bg-transparent p-0 disabled:cursor-not-allowed disabled:opacity-50',
      focusStyles.ring
    ],
    swatch: 'size-full',
    preview: 'pointer-events-none absolute inset-0'
  },
  variants: {
    size: { sm: { root: 'size-4' }, md: { root: 'size-5' } },
    /** A preview that is sometimes an icon, such as an effect's, gets a frame of its own. */
    framed: {
      true: {
        root: 'flex items-center justify-center overflow-hidden border border-border bg-input'
      },
      false: {}
    }
  },
  defaultVariants: { size: 'sm', framed: false }
} as const
