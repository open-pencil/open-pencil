import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import tabsTheme from '@/theme/tabs/index'

export const tabs = tv(tabsTheme)

export type TabsUI = ComponentUI<typeof tabsTheme>

export function useTabsUI(ui?: TabsUI) {
  const cls = tabs()
  return {
    root: cls.root({ class: ui?.root }),
    list: cls.list({ class: ui?.list }),
    trigger: cls.trigger({ class: ui?.trigger }),
    icon: cls.icon({ class: ui?.icon }),
    label: cls.label({ class: ui?.label }),
    trailing: cls.trailing({ class: ui?.trailing }),
    content: cls.content({ class: ui?.content })
  }
}
