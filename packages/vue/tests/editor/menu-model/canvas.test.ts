import { describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import type { EditorCommandId } from '@open-pencil/vue'

import { buildCanvasContextMenu } from '#vue/editor/menu-model/canvas'
import type { CanvasMenuOptions } from '#vue/editor/menu-model/canvas'

/** The canvas menu's command ids for a selection that is an icon or not. */
function menuIds(isIcon: boolean) {
  const menu = buildCanvasContextMenu({
    commandMenuItem: (id: EditorCommandId) => ({ id, label: id }),
    otherPages: [],
    moveSelectionToPage: (pageId: string) => pageId,
    selection: {
      hasSelection: ref(true),
      isGroup: ref(false),
      isComponent: ref(false),
      isInstance: ref(false),
      isIcon: ref(isIcon),
      canCreateComponentSet: ref(false),
      canCreateSlot: ref(false)
    } as CanvasMenuOptions['selection'],
    t: { moveToPage: 'Move to page' }
  })
  return menu.flatMap((item) => (item.separator ? [] : [item.id]))
}

describe('canvas menu for icons', () => {
  test('offers Detach icon only for icons', () => {
    expect(menuIds(true)).toContain('selection.detachIcon')
    expect(menuIds(false)).not.toContain('selection.detachIcon')
  })
})
