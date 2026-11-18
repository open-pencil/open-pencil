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
import { computed } from 'vue'
import IconChevronRight from '~icons/lucide/chevron-right'

import {
  useEditorCommands,
  editorCommandMetadata,
  formatShortcut,
  type EditorCommandId
} from '@open-pencil/vue/editor/commands'
import { useMenuModel } from '@open-pencil/vue/editor/menu-model'
import { useSelectionState } from '@open-pencil/vue/editor/selection-state'
import { useCommentMessages, useI18n } from '@open-pencil/vue/i18n'
import { vTestId } from '@open-pencil/vue/testing'

import { useComments } from '@/app/comments/use'
import { useEditorStore } from '@/app/editor/active-store'
import type { CanvasContextTarget } from '@/app/editor/canvas/context-selection'
import { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import { useCanvasContextMenu } from '@/app/editor/canvas/menu/context'
import { canvasMenuItemClass, canvasMenuShortcutClass } from '@/app/editor/canvas/menu/model'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
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

/** The layer commands the Comment tool's right-click offers on a layer, as in Figma. */
const COMMENT_LAYER_COMMANDS = [
  'selection.toggleVisibility',
  'selection.toggleLock'
] as const satisfies readonly EditorCommandId[]

const store = useEditorStore()
const comments = useComments()
const commentMessages = useCommentMessages()
const commenting = computed(() => store.state.activeTool === 'COMMENT')

const { editor, selectedIds, hasSelection } = useSelectionState()
const { getCommand } = useEditorCommands()
const { canvasMenu } = useMenuModel()
const { menu: t } = useI18n()

const canvasMenuActions = createCanvasMenuActions(store, selectedIds)
const { execCommand } = canvasMenuActions
const contextMenu = useCanvasContextMenu(canvasMenu, hasSelection, editor, canvasMenuActions, t)

const selectedGuide = computed(() => store.state.guides.selected)

function toggleUI() {
  store.state.showUI = !store.state.showUI
}

function removeSelectedGuide() {
  const guide = selectedGuide.value
  if (!guide) return
  store.removeGuide(guide.ownerId, guide.guideId)
  store.setSelectedGuide(null)
}

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
      <!-- The Comment tool keeps its menu short: what a layer shows and how the canvas looks. -->
      <template v-if="commenting && target && target !== 'guide'">
        <template v-if="target === 'layer'">
          <ContextMenuItem
            v-for="id in COMMENT_LAYER_COMMANDS"
            :key="id"
            v-test-id="contextCommandTestId(id)"
            :class="cls.item"
            :disabled="!getCommand(id).enabled.value"
            @select="getCommand(id).run()"
          >
            <span>{{ getCommand(id).label }}</span
            ><AppShortcutText>{{
              formatShortcut(editorCommandMetadata(id).shortcut)
            }}</AppShortcutText>
          </ContextMenuItem>
          <ContextMenuSeparator :class="cls.sep" />
        </template>
        <ContextMenuItem data-test-id="context-toggle-ui" :class="cls.item" @select="toggleUI">
          <span>{{ t.toggleUI }}</span
          ><AppShortcutText>{{ appMenuShortcutLabel('toggle-ui') }}</AppShortcutText>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-hide-comments"
          :class="cls.item"
          @select="comments.toggleOnCanvas"
        >
          <span>{{ commentMessages.hideComments }}</span
          ><AppShortcutText>{{ appMenuShortcutLabel('view-comments') }}</AppShortcutText>
        </ContextMenuItem>
      </template>
      <template v-else-if="selectedGuide">
        <ContextMenuItem data-property="guide" :class="cls.item" @select="removeSelectedGuide">
          <span>{{ t.removeGuide }}</span>
        </ContextMenuItem>
      </template>
      <template v-else>
        <ContextMenuItem
          data-test-id="context-copy"
          :class="cls.item"
          :disabled="!hasSelection"
          @select="execCommand('copy')"
        >
          <span>{{ t.copy }}</span
          ><AppShortcutText>{{ appMenuShortcutLabel('copy') }}</AppShortcutText>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-cut"
          :class="cls.item"
          :disabled="!hasSelection"
          @select="execCommand('cut')"
        >
          <span>{{ t.cut }}</span
          ><AppShortcutText>{{ appMenuShortcutLabel('cut') }}</AppShortcutText>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-paste"
          :class="cls.item"
          @select="execCommand('paste')"
        >
          <span>{{ t.pasteHere }}</span
          ><AppShortcutText>{{ appMenuShortcutLabel('paste') }}</AppShortcutText>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-paste-to-replace"
          :class="cls.item"
          :disabled="!hasSelection"
          @select="canvasMenuActions.pasteToReplace"
        >
          <span>{{ t.pasteToReplace }}</span>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-paste-as-layers"
          :class="cls.item"
          @select="canvasMenuActions.pasteAsLayers"
        >
          <span>{{ t.pasteAsLayers }}</span>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-duplicate"
          :class="cls.item"
          :disabled="!hasSelection"
          @select="getCommand('selection.duplicate').run()"
        >
          <span>{{ getCommand('selection.duplicate').label }}</span
          ><AppShortcutText>{{
            formatShortcut(editorCommandMetadata('selection.duplicate').shortcut)
          }}</AppShortcutText>
        </ContextMenuItem>
        <ContextMenuItem
          data-test-id="context-delete"
          :class="cls.item"
          :disabled="!hasSelection"
          @select="getCommand('selection.delete').run()"
        >
          <span>{{ getCommand('selection.delete').label }}</span
          ><AppShortcutText>{{
            editorCommandMetadata('selection.delete').shortcut
          }}</AppShortcutText>
        </ContextMenuItem>

        <template v-for="(item, i) in contextMenu" :key="`menu-${i}`">
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
            <span
              v-if="item.shortcut"
              class="text-2xs"
              :class="canvasMenuShortcutClass(item.label)"
              >{{ item.shortcut }}</span
            >
          </ContextMenuItem>
        </template>
      </template>
    </MenuScrollArea>
  </ContextMenuContent>
</template>
