import { tv, type VariantProps } from 'tailwind-variants'

import dialogTheme from '@/theme/dialog'

export const dialog = tv(dialogTheme)

export type DialogVariants = VariantProps<typeof dialog>

export interface DialogUI {
  overlay?: string
  content?: string
  header?: string
  heading?: string
  title?: string
  description?: string
  close?: string
  body?: string
  footer?: string
}

export function useDialogUI(ui?: DialogUI, variants?: DialogVariants) {
  const cls = dialog(variants)
  return {
    overlay: cls.overlay({ class: ui?.overlay }),
    content: cls.content({ class: ui?.content }),
    header: cls.header({ class: ui?.header }),
    heading: cls.heading({ class: ui?.heading }),
    title: cls.title({ class: ui?.title }),
    description: cls.description({ class: ui?.description }),
    close: cls.close({ class: ui?.close }),
    body: cls.body({ class: ui?.body }),
    footer: cls.footer({ class: ui?.footer })
  }
}
