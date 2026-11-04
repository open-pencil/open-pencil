import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

const popoverTheme = {
  slots: {
    content: ['z-[100]', floatingSurface, motionStyles.floating],
    header: '',
    body: '',
    footer: ''
  }
} as const

export const popover = tv(popoverTheme)

type PopoverUI = ComponentUI<typeof popoverTheme>

export function usePopoverUI(ui?: PopoverUI) {
  const cls = popover()
  return {
    content: cls.content({ class: ui?.content }),
    header: cls.header({ class: ui?.header }),
    body: cls.body({ class: ui?.body }),
    footer: cls.footer({ class: ui?.footer })
  }
}
