import { CHECKERBOARD_BACKGROUND } from '@/theme/checkerboard'

export default {
  slots: {
    root: 'flex items-center gap-2',
    label: 'w-7 shrink-0 text-[10px] font-medium text-muted',
    slider: 'relative flex h-3 flex-1 touch-none items-center rounded-md select-none',
    track: 'absolute inset-0 overflow-hidden rounded-md',
    thumb:
      'block size-3.5 rounded-full border-2 border-white shadow-sm outline-none ring-offset-1 focus-visible:ring-2 focus-visible:ring-primary',
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
