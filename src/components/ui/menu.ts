import { tv } from 'tailwind-variants'

export const menu = tv({
  slots: {
    content: 'z-50 rounded-lg border border-border bg-panel p-1 shadow-lg',
    item: 'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-muted/50 data-[highlighted]:bg-hover',
    separator: 'mx-1 my-1 h-px bg-border',
    shortcut: 'text-[11px] text-muted',
    icon: 'size-3 text-muted',
    subTrigger:
      'flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs outline-none select-none'
  },
  variants: {
    tone: {
      default: {
        item: 'text-surface',
        subTrigger: 'text-surface'
      },
      component: {
        item: 'text-component data-[disabled]:text-component/40 data-[highlighted]:bg-component/12',
        shortcut: 'text-component/60',
        subTrigger: 'text-component'
      }
    },
    justify: {
      between: {
        item: 'justify-between gap-6'
      },
      start: {
        item: 'justify-start'
      }
    }
  },
  defaultVariants: {
    tone: 'default',
    justify: 'between'
  }
})

interface MenuUI {
  content?: string
  item?: string
  separator?: string
  shortcut?: string
  icon?: string
  subTrigger?: string
}

export function useMenuUI(ui?: MenuUI) {
  const cls = menu()
  return {
    content: cls.content({ class: ui?.content }),
    item: cls.item({ class: ui?.item }),
    separator: cls.separator({ class: ui?.separator }),
    shortcut: cls.shortcut({ class: ui?.shortcut }),
    icon: cls.icon({ class: ui?.icon }),
    subTrigger: cls.subTrigger({ class: ui?.subTrigger })
  }
}

export function menuContent(options?: { class?: string }) {
  return menu().content({ class: options?.class })
}

export function menuItem(options?: {
  tone?: 'default' | 'component'
  justify?: 'between' | 'start'
  class?: string
}) {
  return menu(options).item({ class: options?.class })
}

export function menuSeparator(options?: { class?: string }) {
  return menu().separator({ class: options?.class })
}
