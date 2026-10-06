import { tv } from 'tailwind-variants'

/** People overlapping in a row, each with their agent count, then "+N". */
export const avatarStack = tv({
  slots: {
    root: 'flex items-center -space-x-1.5',
    person: 'relative inline-flex shrink-0',
    badge:
      'absolute -right-1.5 -bottom-1 flex items-center gap-px rounded-full border border-panel bg-panel px-0.5 text-[8px] leading-none font-semibold',
    badgeIcon: 'size-2',
    overflow:
      'relative flex shrink-0 items-center justify-center rounded-full border-2 border-panel bg-hover text-[9px] font-semibold text-surface'
  },
  variants: {
    size: {
      sm: { overflow: 'size-6' },
      md: { overflow: 'size-7' }
    }
  },
  defaultVariants: { size: 'sm' }
})
