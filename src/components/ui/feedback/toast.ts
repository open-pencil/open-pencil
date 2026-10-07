import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import toastTheme from '@/theme/feedback/toast'

import { progressPercent, type ProgressAmount } from './progress'

export const toast = tv(toastTheme)
export type ToastUI = ComponentUI<typeof toastTheme>
export type ToastProgressState = VariantProps<typeof toast>['progress']

/** Selects the toast treatment; non-default tones are dismissible and copyable. */
export type ToastVariant = 'default' | 'warning' | 'error'

export function toastProgressState(progress?: ProgressAmount | null): ToastProgressState {
  if (!progress) return 'none'
  return progressPercent(progress) === null ? 'indeterminate' : 'determinate'
}

export interface ToastProps {
  message: string
  variant?: ToastVariant
  /** Number of times this message repeated while it stayed visible. */
  count?: number
  /** Present while a long-running operation reports progress. */
  progress?: ProgressAmount | null
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
