import { CHECKERBOARD_BACKGROUND } from '@/theme/paint/checkerboard'

export default {
  slots: {
    root: `relative block overflow-hidden rounded border border-border ${CHECKERBOARD_BACKGROUND}`,
    preview: 'pointer-events-none absolute inset-0'
  }
} as const
