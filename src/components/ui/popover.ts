import { tv } from 'tailwind-variants'

export const popover = tv({
  slots: {
    content: 'z-[100] rounded-xl bg-panel shadow-[0_8px_30px_rgb(0_0_0/0.4)]',
    header: '',
    body: '',
    footer: ''
  }
})

interface PopoverUI {
  content?: string
  header?: string
  body?: string
  footer?: string
}

export function usePopoverUI(ui?: PopoverUI) {
  const cls = popover()
  return {
    content: cls.content({ class: ui?.content }),
    header: cls.header({ class: ui?.header }),
    body: cls.body({ class: ui?.body }),
    footer: cls.footer({ class: ui?.footer })
  }
}
