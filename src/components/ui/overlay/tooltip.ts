import { tv } from 'tailwind-variants'

export const tooltip = tv({
  slots: {
    content:
      'z-50 rounded-md bg-panel px-2 py-1 text-[11px] text-surface shadow-[0_8px_30px_rgb(0_0_0/0.4)]'
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
