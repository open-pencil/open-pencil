import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/** The mobile HUD's room pill: the room's state, the people in it, and the list it opens. */
export const presencePopover = tv({
  slots: {
    trigger: 'pl-3 pr-1.5',
    summary: 'flex items-center gap-2',
    dot: [
      'block size-2 shrink-0 rounded-full bg-muted',
      'data-[status=live]:bg-success data-[status=unreachable]:bg-warning-text',
      'data-[status=connecting]:animate-pulse data-[status=looking]:animate-pulse data-[status=receiving]:animate-pulse motion-reduce:animate-none'
    ],
    content: ['z-50 w-60 p-3', floatingSurface, motionStyles.floating]
  }
})
