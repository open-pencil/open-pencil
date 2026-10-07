import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/** The card a page shows on hover: who is on the page, and what their agents do there. */
export const pagePresence = tv({
  slots: {
    card: ['z-50 w-60 p-2', floatingSurface, motionStyles.floating],
    header: 'mb-2 flex items-center gap-2 border-b border-border px-1 pb-2',
    title: 'text-xs text-muted'
  }
})
