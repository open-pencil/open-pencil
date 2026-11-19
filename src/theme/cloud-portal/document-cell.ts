import { focusStyles } from '@/theme/focus/styles'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

/**
 * A document in a console table: its miniature, the larger preview hovering it shows, and its
 * kind's icon before its name, coloured as Home colours it.
 */
export default {
  slots: {
    root: 'flex min-w-0 items-center gap-3',
    miniature:
      'flex h-9 w-12 shrink-0 items-center justify-center overflow-hidden rounded border border-border bg-canvas',
    trigger: [
      'flex h-9 w-12 shrink-0 cursor-default items-center justify-center overflow-hidden rounded border border-border bg-canvas',
      focusStyles.ringStrong
    ],
    image: 'size-full object-contain',
    fallback: 'size-4',
    body: 'min-w-0',
    kind: 'size-3.5 shrink-0',
    name: 'truncate',
    card: ['z-50 p-1.5', floatingSurface, motionStyles.floating],
    preview: 'block max-h-72 max-w-96 rounded bg-canvas object-contain'
  },
  variants: {
    kind: {
      design: { kind: 'text-primary', fallback: 'text-primary' },
      board: { kind: 'text-board', fallback: 'text-board' }
    }
  }
} as const
