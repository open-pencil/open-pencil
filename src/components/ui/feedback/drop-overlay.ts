import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import theme from '@/theme/feedback/drop-overlay'

export const dropOverlay = tv(theme)
type DropOverlayVariants = VariantProps<typeof dropOverlay>

export interface DropOverlayProps {
  /** Whether files are being dragged over the surface. */
  visible: boolean
  /** What dropping does, or why it cannot; the outline alone when omitted. */
  label?: string
  shape?: NonNullable<DropOverlayVariants['shape']>
  /** Whether the surface takes the drop; a refused drop shows muted. */
  accepts?: boolean
  ui?: ComponentUI<typeof theme>
}
