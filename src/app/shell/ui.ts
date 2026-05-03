import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

import { IS_TAURI } from '@open-pencil/core/constants'

export type ToastVariant = 'default' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  /** Number of times this message has been raised since it appeared. */
  count: number
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

function push(message: string, variant: ToastVariant) {
  // Dedupe: if the same message+variant is already visible, increment
  // its repeat count instead of stacking a duplicate. Prevents the
  // cascade-on-every-frame failure mode where a single unhealthy
  // event source floods the viewport.
  const existing = toasts.value.find((t) => t.message === message && t.variant === variant)
  if (existing) {
    existing.count += 1
    existing.id = ++nextId
    return
  }
  toasts.value.push({ id: ++nextId, message, variant, count: 1 })
  if (toasts.value.length > TOAST_STACK_LIMIT) {
    toasts.value.splice(0, toasts.value.length - TOAST_STACK_LIMIT)
  }
}

function info(message: string) {
  push(message, 'default')
}

function warning(message: string) {
  push(message, 'warning')
}

function error(message: string) {
  push(message, 'error')
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
  remove,
  toasts,
  setupGlobalErrorHandler,
  TOAST_DURATION,
  ERROR_TOAST_DURATION
}

export async function openExternalLink(url: string) {
  if (IS_TAURI) {
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
