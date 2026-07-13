import { tv } from 'tailwind-variants'

export const tooltip = tv({
  slots: {
    content:
      'z-50 rounded-md border border-border bg-panel px-2 py-1 text-xs text-surface shadow-lg'
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
