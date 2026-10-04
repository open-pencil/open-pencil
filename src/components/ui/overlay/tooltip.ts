import { tv } from 'tailwind-variants'

import { tooltipSurface } from '@/theme/overlay'

export const tooltip = tv({
  slots: {
    content: ['z-50 px-2 py-1 text-[11px]', tooltipSurface]
  }
})

interface TooltipUI {
  content?: string
}

export function useTooltipUI(ui?: TooltipUI) {
  const cls = tooltip()
  return {
    content: cls.content({ class: ui?.content })
  }
}
