import { collapsibleContentMotion } from '../collapsible/collapsible'

/**
 * The divider a compaction leaves in the transcript: a rule with its label in the middle,
 * which opens the summary. Its spacing sits inside the content, which cannot snap while its
 * height animates.
 */
export default {
  slots: {
    root: 'flex flex-col py-1',
    rule: 'flex items-center gap-2 text-2xs text-muted',
    line: 'h-px min-w-3 flex-1 bg-border',
    toggle:
      'inline-flex min-w-0 items-center gap-1.5 rounded px-1.5 py-0.5 outline-none hover:bg-hover hover:text-surface focus-visible:ring-2 focus-visible:ring-accent',
    icon: 'size-3 shrink-0',
    title: 'truncate',
    chevron:
      'size-3 shrink-0 transition-transform motion-reduce:transition-none [[data-state=open]>&]:rotate-180',
    content: collapsibleContentMotion,
    summary: 'mt-2 flex flex-col gap-1.5 rounded-md bg-hover px-2.5 py-2 text-xs leading-relaxed',
    note: 'text-2xs leading-snug text-muted'
  }
} as const
