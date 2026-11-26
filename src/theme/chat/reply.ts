import { motionStyles } from '../motion/styles'

/** A reply's own details: the tokens it used, and its text's corner. */
export default {
  slots: {
    /** A reply's text fits it, as a request does, leaving room beside it for the copy button. */
    bubble:
      'group/response relative w-fit max-w-[calc(100%-1.75rem)] rounded-xl rounded-ss-md bg-hover px-3 py-2 text-xs leading-relaxed text-surface',
    // Under the reply when the setting shows usage always.
    usage: 'inline-flex items-center gap-2 px-2 text-2xs text-muted',
    // With usage shown on hover, the usage over the last line's end, shown when the text is
    // hovered or focused. It fades out the end of a full last line beneath it, toward the line's
    // end in either direction; a narrow chat fades over less of the line.
    corner: [
      'absolute inset-e-1 bottom-1 flex h-6 max-w-[calc(100%-0.5rem)] items-center text-2xs whitespace-nowrap text-muted opacity-0 [--fade:2rem] group-focus-within/response:opacity-100 group-hover/response:opacity-100 @max-[16rem]/reply:[--fade:0.75rem]',
      motionStyles.reveal
    ],
    // One line of whole parts: a part that does not fit wraps onto a line nobody sees, and the
    // empty item before them lets even the first one go.
    parts: 'flex h-6 min-w-0 flex-1 flex-wrap justify-end overflow-hidden',
    part: 'flex h-6 items-center px-1',
    // Beside the bubble's end, shown when the text is hovered or focused.
    copy: [
      'absolute -inset-e-7 bottom-0 text-muted opacity-0 group-focus-within/response:opacity-100 group-hover/response:opacity-100',
      motionStyles.reveal
    ]
  },
  variants: {
    // The first part shown carries the fade; the line shows again where a dropped part was.
    lead: {
      true: {
        part: 'bg-[linear-gradient(to_right,transparent,var(--color-hover)_var(--fade))] ps-(--fade) rtl:bg-[linear-gradient(to_left,transparent,var(--color-hover)_var(--fade))]'
      },
      false: { part: 'bg-hover' }
    }
  }
} as const
