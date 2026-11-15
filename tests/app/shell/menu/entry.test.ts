import { expect, test } from 'bun:test'

import type { MenuEntry } from '@open-pencil/vue/editor/menu-model'

import { visibleMenuEntries } from '@/app/shell/menu/entry'

const separator: MenuEntry = { separator: true }
const item = (label: string): MenuEntry => ({ label })

test('drops the separators hidden items leave at the ends and next to each other', () => {
  expect(
    visibleMenuEntries([
      separator,
      null,
      item('New'),
      separator,
      null,
      separator,
      item('Settings'),
      separator,
      null
    ])
  ).toEqual([item('New'), separator, item('Settings')])
})

test('leaves a menu of only separators empty', () => {
  expect(visibleMenuEntries([separator, null, separator])).toEqual([])
})
