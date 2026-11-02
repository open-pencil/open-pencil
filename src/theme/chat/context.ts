import { motionStyles } from '../motion/styles'

/**
 * How full the conversation's context is: a ring in the chat's header with its popover, the bar
 * over the message field when it fills up, and the divider a compaction leaves in the transcript.
 */
export default {
  slots: {
    meter:
      'flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 text-3xs text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-hover data-[state=open]:text-surface',
    miniBar: 'flex h-1.5 w-5 shrink-0 overflow-hidden rounded-full bg-border',
    popover: ['z-50 flex w-64 flex-col gap-2.5 p-3 text-2xs text-surface', motionStyles.floating],
    popoverHeader: 'flex items-baseline justify-between gap-2',
    popoverTitle: 'font-medium',
    popoverValue: 'text-muted',
    bar: 'h-1.5 overflow-hidden rounded-full bg-border',
    barValue: 'h-full rounded-full bg-accent data-[full=true]:bg-warning',
    note: 'leading-snug text-muted',
    credits: 'flex items-center justify-between gap-2 text-muted',
    warning:
      'mx-2.5 mb-1 flex items-center gap-2 rounded-md border border-warning-border bg-warning-bg px-2.5 py-1.5 text-2xs text-warning',
    warningLabel: 'min-w-0 flex-1 truncate',
    // A rule across the transcript with its label in the middle; the label opens the summary.
    divider: 'flex flex-col gap-2 py-1',
    dividerRule: 'flex items-center gap-2 text-2xs text-muted',
    dividerLine: 'h-px min-w-3 flex-1 bg-border',
    dividerToggle:
      'inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent',
    dividerIcon: 'size-3 shrink-0',
    dividerTitle: 'truncate',
    dividerChevron: 'size-3 shrink-0 transition-transform data-[open=true]:rotate-180',
    dividerNote: 'text-2xs leading-snug text-muted',
    summary: 'flex flex-col gap-1.5 rounded-md bg-hover px-2.5 py-2 text-xs leading-relaxed',
    // Shown under the reply when the setting shows it always; on hover it sits beside the copy button.
    usage: 'inline-flex items-center gap-2 px-2 text-2xs text-muted',
    // The reply text's corner: the copy button, and with usage on hover the usage too, revealed
    // when the text is hovered or focused.
    replyCorner: [
      'absolute right-1 bottom-1 text-2xs text-muted opacity-0 group-focus-within/response:opacity-100 group-hover/response:opacity-100',
      motionStyles.reveal
    ]
  },
  variants: {
    // Over the bubble's own colour, fading out the end of a full last line beneath it.
    usage: {
      true: {
        replyCorner:
          'flex h-6 items-center gap-1 rounded-br-xl bg-[linear-gradient(to_right,transparent,var(--color-hover)_2rem)] pl-8'
      }
    }
  }
} as const
