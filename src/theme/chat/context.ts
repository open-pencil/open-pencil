import { motionStyles } from '../motion/styles'

/**
 * How full the conversation's context is: a ring in the chat's header with its popover, and
 * the bar over the message field when it fills up.
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
    warningLabel: 'min-w-0 flex-1 truncate'
  }
} as const
