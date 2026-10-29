import { ref } from 'vue'

import type { ToastVariant } from '@/components/ui/feedback/toast'

/** How long a confirmation stays; a failure stays long enough to read. */
const TOAST_DURATION = 4000
const ERROR_TOAST_DURATION = 10000

export type PortalToast = { id: number; message: string; variant: ToastVariant }

const toasts = ref<PortalToast[]>([])
let nextId = 0

function show(message: string, variant: ToastVariant) {
  toasts.value = [
    ...toasts.value.filter((entry) => entry.message !== message),
    { id: ++nextId, message, variant }
  ]
}

/**
 * Short messages the portal shows over the page once a change is done or has failed, the way the
 * editor's toasts do; the editor's own store belongs to its shell, which the portal never loads.
 */
export const portalToast = {
  toasts,
  info: (message: string) => show(message, 'default'),
  error: (message: string) => show(message, 'error'),
  remove(id: number) {
    toasts.value = toasts.value.filter((entry) => entry.id !== id)
  },
  duration: (entry: PortalToast) =>
    entry.variant === 'error' ? ERROR_TOAST_DURATION : TOAST_DURATION
}
