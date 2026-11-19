<script setup lang="ts">
import {
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuSubContent,
  ContextMenuPortal
} from 'reka-ui'
import IconChevronRight from '~icons/lucide/chevron-right'

import {
  useEditorCommands,
  editorCommandMetadata,
  type EditorCommandId
} from '@open-pencil/vue/editor/commands'
import { useMenuModel } from '@open-pencil/vue/editor/menu-model'
import { useSelectionState } from '@open-pencil/vue/editor/selection-state'
import { useCommentMessages, useI18n } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { useEditorStore } from '@/app/editor/active-store'
import type { CanvasContextTarget } from '@/app/editor/canvas/context-selection'
import { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import { useCanvasContextMenu } from '@/app/editor/canvas/menu/context'
import { canvasMenuItemClass, canvasMenuShortcutClass } from '@/app/editor/canvas/menu/model'
import AppShortcutText from '@/components/ui/menu/AppShortcutText.vue'
import { menu, useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'

const { target } = defineProps<{
  /**
   * What a right-click on the canvas landed on; the Comment tool's menu follows it, as in Figma.
   * The layers panel's menu has none and stays the full layer menu.
   */
  target?: CanvasContextTarget
}>()

const store = useEditorStore()
const { editor, selectedIds, hasSelection } = useSelectionState()
const { menuItem } = useEditorCommands()
const { canvasMenu } = useMenuModel()
const { menu: t } = useI18n()
const commentMessages = useCommentMessages()

const entries = useCanvasContextMenu(
  () => ({
    target,
    commenting: store.state.activeTool === 'COMMENT',
    guideSelected: store.state.guides.selected !== null,
    hasSelection: hasSelection.value
  }),
  () => ({
    editor,
    commandMenuItem: menuItem,
    layerEntries: canvasMenu.value,
    labels: { ...t.value, hideComments: commentMessages.value.hideComments }
  }),
  createCanvasMenuActions(store, selectedIds)
)

const menuCls = useMenuUI({
  content: 'min-w-56 max-w-80',
  separator: 'my-1'
})
const componentMenu = menu({ tone: 'component' })

const cls = {
  menu: menuCls.content,
  submenu: menuCls.content.replace('min-w-56', 'min-w-0 w-max'),
  item: menuCls.item,
  component: componentMenu.item(),
  sep: menuCls.separator
}

function contextCommandTestId(id: EditorCommandId | undefined): string | undefined {
  return id ? editorCommandMetadata(id).contextTestId : undefined
}
</script>

<template>
  <!-- Closing hands focus back to the canvas; when that lands just after a quick reopen, it
       must not close the new menu. Clicks outside and Escape still close it. -->
  <ContextMenuContent :class="cls.menu" :side-offset="2" align="start" @close-auto-focus.prevent>
    <MenuScrollArea>
      <template v-for="(item, i) in entries" :key="i">
        <ContextMenuSeparator v-if="item.separator" :class="cls.sep" />
        <ContextMenuSub v-else-if="item.sub">
          <ContextMenuSubTrigger v-test-id="item.testId" :class="cls.item">
            <span>{{ item.label }}</span>
            <IconChevronRight data-direction="reading" class="size-3.5 text-muted" />
          </ContextMenuSubTrigger>
          <ContextMenuPortal>
            <ContextMenuSubContent :class="cls.submenu">
              <MenuScrollArea>
                <template v-for="(sub, j) in item.sub" :key="j">
                  <ContextMenuSeparator v-if="sub.separator" :class="cls.sep" />
                  <ContextMenuItem
                    v-else
                    :class="cls.item"
                    v-test-id="sub.testId"
                    :disabled="sub.disabled"
                    @select="sub.action?.()"
                  >
                    <span class="min-w-0 flex-1 truncate">{{ sub.label }}</span>
                    <AppShortcutText v-if="sub.shortcut">{{ sub.shortcut }}</AppShortcutText>
                  </ContextMenuItem>
                </template>
              </MenuScrollArea>
            </ContextMenuSubContent>
          </ContextMenuPortal>
        </ContextMenuSub>
        <ContextMenuItem
          v-else
          v-test-id="item.testId ?? contextCommandTestId(item.id)"
          :class="canvasMenuItemClass(item.label, cls)"
          :disabled="item.disabled"
          @select="item.action?.()"
        >
          <span class="min-w-0 flex-1 truncate">{{ item.label }}</span>
          <AppShortcutText v-if="item.shortcut" :ui="{ base: canvasMenuShortcutClass(item.label) }">
            {{ item.shortcut }}
          </AppShortcutText>
        </ContextMenuItem>
      </template>
    </MenuScrollArea>
  </ContextMenuContent>
</template>
