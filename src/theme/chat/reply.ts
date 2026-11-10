import { motionStyles } from '../motion/styles'

/** A reply's own details: the tokens it used, and its text's corner. */
export default {
  slots: {
    // Under the reply when the setting shows usage always.
    usage: 'inline-flex items-center gap-2 px-2 text-2xs text-muted',
    // The copy button, and with usage on hover the usage too, shown when the text is hovered or
    // focused.
    corner: [
      'absolute inset-e-1 bottom-1 text-2xs text-muted opacity-0 group-focus-within/response:opacity-100 group-hover/response:opacity-100',
      motionStyles.reveal
    ]
  },
  variants: {
    // Over the bubble's own colour, fading out the end of a full last line beneath it.
    usage: {
      true: {
        corner:
          'flex h-6 items-center gap-1 rounded-ee-xl bg-[linear-gradient(to_right,transparent,var(--color-hover)_2rem)] ps-8'
      }
    }
  }
} as const
