import { useEventListener } from '@vueuse/core'
import { ref } from 'vue'

export type ToastVariant = 'default' | 'warning' | 'error'

export interface Toast {
  id: number
  message: string
  variant: ToastVariant
}

const TOAST_DURATION = 3000

const toasts = ref<Toast[]>([])
let nextId = 0
let errorHandlersInitialized = false

function show(message: string, variant: ToastVariant = 'default') {
  toasts.value.push({ id: ++nextId, message, variant })
}

function remove(id: number) {
  toasts.value = toasts.value.filter((t) => t.id !== id)
}

function setupGlobalErrorHandler() {
  if (errorHandlersInitialized) return
  errorHandlersInitialized = true

  useEventListener(window, 'error', (e) => {
    show(e.message || 'An unexpected error occurred', 'error')
  })
  useEventListener(window, 'unhandledrejection', (e) => {
    const msg = e.reason instanceof Error ? e.reason.message : String(e.reason)
    show(msg || 'An unexpected error occurred', 'error')
  })
}

export const toast = { show, remove, toasts, setupGlobalErrorHandler, TOAST_DURATION }
