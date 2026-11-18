/** People overlapping in a row, each with their agent count, then "+N". */
export default {
  slots: {
    root: 'flex items-center -space-x-1.5',
    person: 'relative inline-flex shrink-0',
    badge:
      'absolute -inset-e-1.5 -bottom-1 flex items-center gap-px rounded-full border border-panel bg-panel px-0.5 text-5xs leading-none font-semibold',
    badgeIcon: 'size-2',
    /** On someone in the voice call with their microphone off. */
    muted:
      'absolute -bottom-1 -inset-s-1 flex size-3 items-center justify-center rounded-full border border-panel bg-panel text-muted',
    mutedIcon: 'size-2',
    overflow:
      'relative flex shrink-0 items-center justify-center rounded-full border-2 border-panel bg-hover text-4xs font-semibold text-surface'
  },
  variants: {
    size: {
      sm: { overflow: 'size-6' },
      md: { overflow: 'size-7' }
    }
  },
  defaultVariants: { size: 'sm' }
} as const
