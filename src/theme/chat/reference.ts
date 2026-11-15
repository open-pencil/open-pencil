/** A reference sits in a line of text like a word: the tool call's node chip, inline. */
export default {
  slots: {
    root: 'mx-px inline-flex max-w-48 cursor-pointer items-center gap-1 rounded border border-border bg-input px-1 align-[-0.2em] text-[0.92em] leading-[1.35] text-surface hover:border-accent hover:text-primary disabled:cursor-default disabled:hover:border-border disabled:hover:text-surface data-[present=false]:text-muted data-[present=false]:line-through',
    icon: 'size-3 shrink-0 text-muted',
    label: 'truncate'
  }
} as const
