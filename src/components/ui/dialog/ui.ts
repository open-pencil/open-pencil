import { tv, type VariantProps } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import dialogTheme from '@/theme/dialog/index'

export const dialog = tv(dialogTheme)

export type DialogVariants = VariantProps<typeof dialog>

export type DialogUI = ComponentUI<typeof dialogTheme>

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
