import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import progressTheme from '@/theme/feedback/progress'

export const progress = tv(progressTheme)
export type ProgressUI = ComponentUI<typeof progressTheme>
export type ProgressTone = VariantProps<typeof progress>['tone']

/** Work reported by a long-running operation. */
export interface ProgressAmount {
  /** Completed units. */
  value?: number
  /** Total units; omit alongside `value` when the producer cannot measure the work. */
  max?: number
}

/** The rounded share of the work done, or null when it cannot be measured. */
export function progressPercent(amount?: ProgressAmount | null): number | null {
  if (amount?.value === undefined || amount.max === undefined) return null
  if (amount.max <= 0) return null
  return Math.min(100, Math.max(0, Math.round((amount.value / amount.max) * 100)))
}

/** A byte count for a progress label, in binary units. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const kib = bytes / 1024
  if (kib < 1024) return `${kib.toFixed(1)} KiB`
  return `${(kib / 1024).toFixed(1)} MiB`
}
