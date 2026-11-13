import { focusStyles } from '@/theme/focus/styles'
import { CHECKERBOARD_BACKGROUND } from '@/theme/paint/checkerboard'

export default {
  slots: {
    root: 'flex items-center gap-2',
    label: 'w-7 shrink-0 text-3xs font-medium text-muted',
    slider: 'relative flex h-3 flex-1 touch-none items-center rounded-md select-none',
    track: 'absolute inset-0 overflow-hidden rounded-md',
    // The offset keeps the ring clear of the gradient under the thumb.
    thumb: [
      'block size-3.5 rounded-full border-2 border-white shadow-sm ring-offset-1',
      focusStyles.ringStrong
    ],
    input: 'w-14 flex-none shrink-0'
  },
  variants: {
    checkerboard: {
      true: {
        slider: CHECKERBOARD_BACKGROUND
      },
      false: {}
    }
  },
  defaultVariants: {
    checkerboard: false
  }
} as const
