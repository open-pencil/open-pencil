import { tv } from 'tailwind-variants'

import type { ComponentUI } from '@/components/ui/types'
import tableTheme from '@/theme/table/index'

export const table = tv(tableTheme)

export type TableUI = ComponentUI<typeof tableTheme>

export function useTableUI(ui?: TableUI) {
  const cls = table()
  return {
    root: cls.root({ class: ui?.root }),
    scroller: cls.scroller({ class: ui?.scroller }),
    table: cls.table({ class: ui?.table }),
    header: cls.header({ class: ui?.header }),
    head: cls.head({ class: ui?.head }),
    body: cls.body({ class: ui?.body }),
    row: cls.row({ class: ui?.row }),
    cell: cls.cell({ class: ui?.cell }),
    empty: cls.empty({ class: ui?.empty }),
    refresh: cls.refresh({ class: ui?.refresh }),
    footer: cls.footer({ class: ui?.footer }),
    pagination: cls.pagination({ class: ui?.pagination }),
    range: cls.range({ class: ui?.range }),
    pages: cls.pages({ class: ui?.pages })
  }
}
