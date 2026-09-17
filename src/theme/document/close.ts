import type { DialogUI } from '@/components/ui/dialog/ui'

export const documentCloseUI = {
  header: 'border-b-0 px-5 pt-5 pb-4',
  title: 'mb-1 text-pretty break-words',
  description: 'leading-relaxed',
  footer: 'border-t-0 px-5 pt-0 pb-5'
} satisfies DialogUI

export const documentCloseButtonUI = { base: 'min-w-18 justify-center' }
