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
    ],
    parts: '',
    part: 'flex h-6 items-center px-1',
    copy: ''
  },
  variants: {
    // Over the bubble's own colour, fading out the end of a full last line beneath it, toward
    // the line's end in either direction. A narrow reply fades over less of the line.
    usage: {
      true: {
        corner:
          'flex h-6 max-w-[calc(100%-0.5rem)] items-center whitespace-nowrap [--fade:2rem] @max-[16rem]/reply:[--fade:0.75rem]',
        // One line of whole parts: a part that does not fit wraps onto a line nobody sees, and
        // the empty item before them lets even the first one go.
        parts: 'flex h-6 min-w-0 flex-1 flex-wrap justify-end overflow-hidden',
        copy: 'rounded-ee-xl bg-hover'
      }
    },
    // The first part shown carries the fade; the line shows again where a dropped part was.
    lead: {
      true: {
        part: 'bg-[linear-gradient(to_right,transparent,var(--color-hover)_var(--fade))] ps-(--fade) rtl:bg-[linear-gradient(to_left,transparent,var(--color-hover)_var(--fade))]'
      },
      false: { part: 'bg-hover' }
    }
  }
} as const
