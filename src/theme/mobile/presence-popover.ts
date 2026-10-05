import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

export const presencePopover = tv({
  slots: {
    dot: 'size-2 rounded-full bg-green-500',
    content: ['z-50 w-56 p-3', floatingSurface, motionStyles.floating],
    peerRow:
      'flex cursor-pointer items-center gap-2 rounded-md px-0.5 py-0.5 outline-none select-none active:bg-hover focus-visible:ring-1 focus-visible:ring-accent'
  }
})
