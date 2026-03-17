import { twMerge } from 'tailwind-merge'
import { tv } from 'tailwind-variants'

import type { ToastVariant } from '@/utils/toast'

const toast = tv({
  base: 'flex max-w-sm items-start gap-1.5 rounded-md px-2.5 py-1.5 text-xs text-white shadow-md data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-1 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-1 data-[swipe=cancel]:translate-y-0 data-[swipe=cancel]:transition-transform data-[swipe=move]:translate-y-[var(--reka-toast-swipe-move-y)]',
  variants: {
    tone: {
      default: 'bg-blue-600',
      warning: 'bg-amber-600',
      error: 'bg-red-600'
    }
  },
  defaultVariants: { tone: 'default' }
})

export function toastRoot(options?: { tone?: ToastVariant; class?: string }) {
  return twMerge(toast(options), options?.class)
}
