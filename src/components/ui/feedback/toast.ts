import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import toastTheme from '@/theme/feedback/toast'

export const toast = tv(toastTheme)
export type ToastUI = ComponentUI<typeof toastTheme>
export type ToastProgressState = VariantProps<typeof toast>['progress']

/** Selects the toast treatment; non-default tones are dismissible and copyable. */
export type ToastVariant = 'default' | 'warning' | 'error'

/** Progress reported by a long-running operation behind a toast. */
export interface ToastProgress {
  /** Completed units. */
  value?: number
  /** Total units; omit alongside `value` when the producer cannot measure the work. */
  max?: number
}

export function toastProgressPercent(progress?: ToastProgress | null): number | null {
  if (progress?.value === undefined || progress.max === undefined) return null
  if (progress.max <= 0) return null
  return Math.min(100, Math.max(0, Math.round((progress.value / progress.max) * 100)))
}

export function toastProgressState(progress?: ToastProgress | null): ToastProgressState {
  if (!progress) return 'none'
  return toastProgressPercent(progress) === null ? 'indeterminate' : 'determinate'
}

export interface ToastProps {
  message: string
  variant?: ToastVariant
  /** Number of times this message repeated while it stayed visible. */
  count?: number
  /** Present while a long-running operation reports progress. */
  progress?: ToastProgress | null
  /** Measurement text beside the bar, formatted by the producing domain. */
  progressLabel?: string
  /** Renders an inline action that emits `action` when pressed. */
  actionLabel?: string
  /** Milliseconds before auto-dismissal; 0 keeps a reported-progress toast open. */
  duration?: number
  copyable?: boolean
  copyLabel?: string
  copiedLabel?: string
  closeLabel?: string
  ui?: ToastUI
}
