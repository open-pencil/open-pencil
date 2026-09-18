import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import bannerTheme from '@/theme/feedback/banner'

export const banner = tv(bannerTheme)
export type BannerUI = ComponentUI<typeof bannerTheme>

export interface BannerProps {
  /** Persist dismissal under this key; omit to keep the banner permanently visible. */
  storageKey?: string
  testId?: string
  ui?: BannerUI
}
