import { invoke } from '@tauri-apps/api/core'
import { useEventListener } from '@vueuse/core'
import { ref, toRaw } from 'vue'

import { RefusedEditError } from '@open-pencil/core'

import { recordRuntimeError } from '@/app/diagnostics'
import { reportErrorAction } from '@/app/reports/state'
import { isTauri } from '@/app/tauri/env'
import type { ProgressAmount } from '@/components/ui/feedback/progress'
import type { ToastVariant } from '@/components/ui/feedback/toast'

export type { ToastVariant } from '@/components/ui/feedback/toast'

export interface ToastAction {
  label: string
  /** Gets the toast it was clicked on, for actions that close it once their work is done. */
  run: (toastId: number) => void
}

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
  /** Number of times this message has been raised since it appeared. */
  count: number
  action?: ToastAction
  /** Present while a long-running operation behind this toast reports progress. */
  progress?: ProgressAmount
  /** Measurement text beside the progress bar, formatted by the producing domain. */
  progressLabel?: string
}

export interface ToastPatch {
  message?: string
  /** `null` clears the bar, which resumes the toast's normal auto-dismissal. */
  progress?: ProgressAmount | null
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

/** Returns the toast's ID, which `remove` takes, also when it merged into a visible one. */
function push(message: string, variant: ToastVariant, action?: ToastAction): number {
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
    return existing.id
  }
  const id = ++nextId
  toasts.value.push({ id, message, variant, count: 1, action })
  trim()
  return id
}

function trim() {
  if (toasts.value.length > TOAST_STACK_LIMIT) {
    toasts.value.splice(0, toasts.value.length - TOAST_STACK_LIMIT)
  }
}

/** Toast-driven work keeps its toast open until progress clears or the work ends. */
export function toastDuration(entry: Toast): number {
  if (entry.progress) return 0
  // A toast that offers an action stays long enough to reach it.
  return entry.variant === 'error' || entry.action ? ERROR_TOAST_DURATION : TOAST_DURATION
}

function startProgress(
  message: string,
  options: { variant?: ToastVariant; progress?: ProgressAmount; progressLabel?: string } = {}
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

function info(message: string, action?: ToastAction) {
  push(message, 'default', action)
}

function warning(message: string) {
  push(message, 'warning')
}

function error(message: string, action?: ToastAction): number {
  return push(message, 'error', action)
}

function remove(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

/**
 * Removes the toast once its action is done, unless a later message merged into it and brought
 * an action of its own, which stays on offer.
 */
function removeOffer(id: number, action: ToastAction) {
  toasts.value = toasts.value.filter((t) => t.id !== id || toRaw(t.action) !== action)
}

function setupGlobalErrorHandler() {
  if (errorHandlersInitialized) return
  errorHandlersInitialized = true

  // An edit the document refuses, as a read-only one's, does nothing, as in Figma.
  useEventListener(window, 'error', (e) => {
    if (e.error instanceof RefusedEditError) {
      e.preventDefault()
      return
    }
    recordRuntimeError(e.error ?? e.message, 'window')
    error(
      e.message || 'An unexpected error occurred',
      reportErrorAction(e.error ?? e.message, 'window')
    )
  })
  useEventListener(window, 'unhandledrejection', (e) => {
    if (e.reason instanceof RefusedEditError) {
      e.preventDefault()
      return
    }
    recordRuntimeError(e.reason, 'rejection')
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    error(msg || 'An unexpected error occurred', reportErrorAction(e.reason, 'rejection'))
  })
}

export const toast = {
  info,
  warning,
  error,
  startProgress,
  remove,
  removeOffer,
  toasts,
  setupGlobalErrorHandler,
  TOAST_DURATION,
  ERROR_TOAST_DURATION
}

export async function openExternalLink(url: string) {
  if (isTauri()) {
    // An app command, so native tests can read the address instead of opening a browser.
    await invoke('open_external_url', { url })
  } else {
    // Without an opener, the page cannot navigate the editor's tab.
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}
export function decodeTauriStderr(raw: Uint8Array | number[] | string): string {
  if (typeof raw === 'string') return raw
  return new TextDecoder().decode(raw instanceof Uint8Array ? raw : new Uint8Array(raw))
}
