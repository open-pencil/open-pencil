import { tv } from 'tailwind-variants'

export const dialog = tv({
  slots: {
    overlay: 'fixed inset-0 z-40 bg-black/50',
    content:
      'fixed top-1/2 left-1/2 z-50 -translate-x-1/2 -translate-y-1/2 rounded-xl bg-panel shadow-[0_8px_30px_rgb(0_0_0/0.4)] outline-none',
    title: 'text-sm font-semibold text-surface',
    description: 'text-xs text-muted'
  }
})

interface DialogUI {
  overlay?: string
  content?: string
  title?: string
  description?: string
}

export function useDialogUI(ui?: DialogUI) {
  const cls = dialog()
  return {
    overlay: cls.overlay({ class: ui?.overlay }),
    content: cls.content({ class: ui?.content }),
    title: cls.title({ class: ui?.title }),
    description: cls.description({ class: ui?.description })
  }
}
