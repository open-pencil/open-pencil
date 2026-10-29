import { tv } from 'tailwind-variants'

import { motionStyles } from '@/theme/motion/styles'
import { floatingSurface } from '@/theme/overlay'

export const menu = tv({
  slots: {
    // Reka sets only the open menu's own variable, so one chain caps every kind of menu just short
    // of the window edge; a `MenuScrollArea` inside scrolls a taller one.
    content: [
      'z-50 flex max-h-[calc(var(--reka-menubar-content-available-height,var(--reka-dropdown-menu-content-available-height,var(--reka-context-menu-content-available-height)))-0.5rem)] flex-col p-1',
      floatingSurface,
      motionStyles.floating
    ],
    item: 'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] outline-none select-none data-[disabled]:cursor-default data-[disabled]:text-muted/50 data-[highlighted]:bg-hover',
    separator: 'mx-1 my-1 h-px bg-border',
    label: 'px-2 pt-1.5 pb-1 text-[11px] text-muted select-none',
    shortcut: 'text-[11px] text-muted',
    icon: 'size-3 text-muted',
    subTrigger:
      'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[11px] outline-none select-none',
    // As in Figma and macOS menus: no scrollbar, a chevron strip over each end that has more.
    // No overscroll: WebKit's bounce takes the top past zero, which kept the top strip showing.
    scrollRoot: 'relative flex min-h-0 flex-col',
    scrollViewport: 'scrollbar-none min-h-0 flex-1 scroll-py-5 overflow-y-auto overscroll-none',
    scrollButton:
      'absolute inset-x-0 z-10 flex h-5 cursor-default items-center justify-center bg-panel text-muted data-[edge=bottom]:bottom-0 data-[edge=top]:top-0'
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
  label?: string
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
    label: cls.label({ class: ui?.label }),
    shortcut: cls.shortcut({ class: ui?.shortcut }),
    icon: cls.icon({ class: ui?.icon }),
    subTrigger: cls.subTrigger({ class: ui?.subTrigger }),
    scrollRoot: cls.scrollRoot(),
    scrollViewport: cls.scrollViewport(),
    scrollButton: cls.scrollButton()
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
