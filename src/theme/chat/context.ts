import { motionStyles } from '../motion/styles'

/**
 * How full the conversation's context is: a ring in the chat's header with its popover, the bar
 * over the message field when it fills up, and the divider a compaction leaves in the transcript.
 */
export default {
  slots: {
    meter:
      'flex h-6 shrink-0 cursor-pointer items-center gap-1 rounded px-1.5 text-[10px] text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent data-[state=open]:bg-hover data-[state=open]:text-surface',
    miniBar: 'flex h-1.5 w-5 shrink-0 overflow-hidden rounded-full bg-border',
    popover: [
      'z-50 flex w-64 flex-col gap-2.5 p-3 text-[11px] text-surface',
      motionStyles.floating
    ],
    popoverHeader: 'flex items-baseline justify-between gap-2',
    popoverTitle: 'font-medium',
    popoverValue: 'text-muted',
    bar: 'h-1.5 overflow-hidden rounded-full bg-border',
    barValue: 'h-full rounded-full bg-accent data-[full=true]:bg-warning',
    note: 'leading-snug text-muted',
    actions: 'flex gap-1.5',
    toggle: 'flex cursor-pointer items-center gap-2',
    separator: 'h-px bg-border',
    credits: 'flex items-center justify-between gap-2 text-muted',
    warning:
      'mx-2.5 mb-1 flex items-center gap-2 rounded-md border border-warning-border bg-warning-bg px-2.5 py-1.5 text-[11px] text-warning',
    warningLabel: 'min-w-0 flex-1 truncate',
    divider:
      'flex flex-col gap-1.5 rounded-lg border border-border bg-panel px-3 py-2 text-[11px] text-surface',
    dividerHeader: 'flex items-center gap-2',
    dividerIcon: 'size-3.5 shrink-0 text-accent',
    dividerTitle: 'flex-1 font-medium',
    dividerTokens: 'shrink-0 text-muted',
    dividerNote: 'leading-snug text-muted',
    summary: 'rounded-md bg-hover px-2.5 py-2 text-xs leading-relaxed',
    addTrigger:
      'flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-muted outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-default disabled:opacity-50 data-[state=open]:bg-hover data-[state=open]:text-surface',
    // Shown while the reply is hovered or focused, unless the setting shows it always.
    usage:
      'inline-flex items-center gap-2 px-2 text-[11px] text-muted transition-opacity data-[display=hover]:opacity-0 data-[display=hover]:group-hover/reply:opacity-100 data-[display=hover]:group-focus-within/reply:opacity-100'
  }
} as const
