import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import { isTauri } from '@/app/tauri/env'
import type { ToastProgress, ToastVariant } from '@/components/ui/feedback/toast'

export type { ToastProgress, ToastVariant } from '@/components/ui/feedback/toast'

export interface ToastAction {
  label: string
  run: () => void
}

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  /** Number of times this message has been raised since it appeared. */
  count: number
  action?: ToastAction
  /** Present while a long-running operation behind this toast reports progress. */
  progress?: ToastProgress
  /** Measurement text beside the progress bar, formatted by the producing domain. */
  progressLabel?: string
}

export interface ToastPatch {
  message?: string
  /** `null` clears the bar, which resumes the toast's normal auto-dismissal. */
  progress?: ToastProgress | null
  /** `null` removes the measurement line. */
  progressLabel?: string | null
}

/** Handle for a toast that a long-running operation updates until it finishes. */
export interface ToastHandle {
  update(patch: ToastPatch): void
  dismiss(): void
}

const TOAST_DURATION = 3000
// Errors stay long enough to read but always self-clean, so a
// stuck/repeating error source can't pile up over the canvas.
const ERROR_TOAST_DURATION = 10000
// Hard cap on stacked toasts. Older toasts drop off when a new one would
// exceed this. Belt-and-suspenders against any error source we missed.
const TOAST_STACK_LIMIT = 5

const toasts = ref<Toast[]>([])
let nextId = 0
let errorHandlersInitialized = false

function push(message: string, variant: ToastVariant, action?: ToastAction) {
  // Dedupe: if the same message+variant is already visible, increment
  // its repeat count instead of stacking a duplicate. Prevents the
  // cascade-on-every-frame failure mode where a single unhealthy
  // event source floods the viewport. Toasts driven by a progress handle
  // are addressed by that handle and must never absorb or merge messages.
  const existing = toasts.value.find(
    (t) => t.message === message && t.variant === variant && !t.progress
  )
  if (existing) {
    existing.count += 1
    existing.action = action
    return
  }
  toasts.value.push({ id: ++nextId, message, variant, count: 1, action })
  trim()
}

function trim() {
  if (toasts.value.length > TOAST_STACK_LIMIT) {
    toasts.value.splice(0, toasts.value.length - TOAST_STACK_LIMIT)
  }
}

/** Toast-driven work keeps its toast open until progress clears or the work ends. */
export function toastDuration(entry: Toast): number {
  if (entry.progress) return 0
  return entry.variant === 'error' ? ERROR_TOAST_DURATION : TOAST_DURATION
}

function startProgress(
  message: string,
  options: { variant?: ToastVariant; progress?: ToastProgress; progressLabel?: string } = {}
): ToastHandle {
  const id = ++nextId
  toasts.value.push({
    id,
    message,
    variant: options.variant ?? 'default',
    count: 1,
    progress: options.progress ?? {},
    progressLabel: options.progressLabel
  })
  trim()
  return {
    update(patch) {
      // Resolve through the array so mutations land on the reactive proxy and
      // a toast that was trimmed or dismissed in the meantime is left alone.
      const entry = toasts.value.find((t) => t.id === id)
      if (!entry) return
      if (patch.message !== undefined) entry.message = patch.message
      if (patch.progress !== undefined) entry.progress = patch.progress ?? undefined
      if (patch.progressLabel !== undefined) entry.progressLabel = patch.progressLabel ?? undefined
    },
    dismiss() {
      remove(id)
    }
  }
}

function info(message: string) {
  push(message, 'default')
}

function warning(message: string) {
  push(message, 'warning')
}

function error(message: string, action?: ToastAction) {
  push(message, 'error', action)
}

function remove(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function setupGlobalErrorHandler() {
  if (errorHandlersInitialized) return
  errorHandlersInitialized = true

  useEventListener(window, 'error', (e) => {
    error(e.message || 'An unexpected error occurred')
  })
  useEventListener(window, 'unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    error(msg || 'An unexpected error occurred')
  })
}

export const toast = {
  info,
  warning,
  error,
  startProgress,
  remove,
  toasts,
  setupGlobalErrorHandler,
  TOAST_DURATION,
  ERROR_TOAST_DURATION
}

export async function openExternalLink(url: string) {
  if (isTauri()) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else {
    window.open(url, '_blank')
  }
}
export function initials(name: string): string {
  return (
    name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2) || '?'
  )
}
export function decodeTauriStderr(raw: Uint8Array | number[] | string): string {
  if (typeof raw === 'string') return raw
  return new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
}
