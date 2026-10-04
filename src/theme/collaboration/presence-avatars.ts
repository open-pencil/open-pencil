import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/** The avatar stack in the toolbar: you, collaborators with their agent counts, then "+N". */
export const presenceAvatars = tv({
  slots: {
    root: 'flex items-center -space-x-1.5',
    trigger:
      'relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent',
    badge:
      'absolute -right-1.5 -bottom-1 flex items-center gap-px rounded-full border border-panel bg-panel px-0.5 text-[8px] leading-none font-semibold',
    badgeIcon: 'size-2',
    /** On your avatar while you are in a room. */
    live: 'absolute -top-0.5 -right-0.5 size-2 rounded-full border border-panel bg-[var(--color-success-bg)]',
    overflow:
      'relative flex size-6 shrink-0 cursor-pointer items-center justify-center rounded-full border-2 border-panel bg-hover text-[9px] font-semibold text-surface outline-none focus-visible:ring-2 focus-visible:ring-accent',
    card: ['z-50 w-60 p-2', floatingSurface, motionStyles.floating],
    leave: 'mt-2 w-full'
  }
})
