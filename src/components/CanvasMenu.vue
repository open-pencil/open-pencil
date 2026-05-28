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
import IconCombine from '~icons/lucide/combine'
import IconCopyMinus from '~icons/lucide/copy-minus'
import IconCopyX from '~icons/lucide/copy-x'
import IconListCollapse from '~icons/lucide/list-collapse'
import IconSpline from '~icons/lucide/spline'
import IconTypeOutline from '~icons/lucide/type-outline'
import IconSquaresIntersect from '~icons/lucide/squares-intersect'
import {
  vTestId,
  useEditorCommands,
  useI18n,
  useMenuModel,
  useSelectionState,
  editorCommandMetadata,
  formatShortcut,
  useViewportKind
} from '@open-pencil/vue'
import type { Component } from 'vue'
import type { EditorCommandId } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { createCanvasMenuActions } from '@/app/editor/canvas/menu/actions'
import { useCanvasContextMenu } from '@/app/editor/canvas/menu/context'
import { canvasMenuItemClass, canvasMenuShortcutClass } from '@/app/editor/canvas/menu/model'
import AppShortcutText from '@/components/ui/AppShortcutText.vue'
import { menu, useMenuUI } from '@/components/ui/menu'

const store = useEditorStore()

const { editor, selectedIds, hasSelection } = useSelectionState()
const { getCommand } = useEditorCommands()
const { canvasMenu } = useMenuModel()
const { menu: t } = useI18n()
const { isMobile } = useViewportKind()

const canvasMenuActions = createCanvasMenuActions(store, selectedIds)
const { execCommand } = canvasMenuActions
const contextMenu = useCanvasContextMenu(canvasMenu, hasSelection, editor, canvasMenuActions, t)

const menuCls = useMenuUI({
  content: 'min-w-56 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95',
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

const booleanCommandIcons = {
  'selection.booleanUnion': IconCombine,
  'selection.booleanSubtract': IconCopyMinus,
  'selection.booleanIntersect': IconSquaresIntersect,
  'selection.booleanExclude': IconCopyX,
  'selection.flatten': IconListCollapse,
  'selection.outlineText': IconTypeOutline,
  'selection.outlineStroke': IconSpline
} satisfies Partial<Record<EditorCommandId, Component>>

const canSplitPane = computed(
  () => !isMobile.value && store.visiblePaneCount.value < store.maxVisiblePanes
)
const canClosePane = computed(() => !isMobile.value && store.visiblePaneCount.value > 1)

function contextCommandTestId(id: EditorCommandId | undefined): string | undefined {
  return id ? editorCommandMetadata(id).contextTestId : undefined
}

function contextCommandIcon(id: EditorCommandId | undefined): Component | undefined {
  if (!id) return undefined
  return (booleanCommandIcons as Partial<Record<EditorCommandId, Component>>)[id]
}

function splitPane(direction: 'horizontal' | 'vertical') {
  store.splitPane(store.activePaneId.value, direction)
}

function closeActivePane() {
  store.closePane(store.activePaneId.value)
}
</script>

<template>
  <ContextMenuContent :class="cls.menu" :side-offset="2" align="start">
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
    <ContextMenuItem data-test-id="context-paste" :class="cls.item" @select="execCommand('paste')">
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
    <template v-if="!isMobile">
      <ContextMenuSeparator :class="cls.sep" />
      <ContextMenuItem
        data-test-id="context-split-pane-right"
        :class="cls.item"
        :disabled="!canSplitPane"
        @select="splitPane('horizontal')"
      >
        <span>Split Pane Right</span>
      </ContextMenuItem>
      <ContextMenuItem
        data-test-id="context-split-pane-down"
        :class="cls.item"
        :disabled="!canSplitPane"
        @select="splitPane('vertical')"
      >
        <span>Split Pane Down</span>
      </ContextMenuItem>
      <ContextMenuItem
        data-test-id="context-close-pane"
        :class="cls.item"
        :disabled="!canClosePane"
        @select="closeActivePane"
      >
        <span>Close Pane</span>
      </ContextMenuItem>
    </template>
    <ContextMenuSeparator :class="cls.sep" />
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
      ><AppShortcutText>{{ editorCommandMetadata('selection.delete').shortcut }}</AppShortcutText>
    </ContextMenuItem>

    <template v-for="(item, i) in contextMenu" :key="`menu-${i}`">
      <ContextMenuSeparator v-if="item.separator" :class="cls.sep" />
      <ContextMenuSub v-else-if="item.sub">
        <ContextMenuSubTrigger v-test-id="item.testId" :class="cls.item">
          <span>{{ item.label }}</span
          ><span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="cls.submenu">
            <ContextMenuItem
              v-for="(sub, j) in item.sub"
              :key="j"
              :class="cls.item"
              v-test-id="sub.separator ? undefined : sub.testId"
              :disabled="sub.separator ? true : sub.disabled"
              @select="!sub.separator && sub.action?.()"
            >
              <template v-if="!sub.separator">
                <span class="flex min-w-0 flex-1 items-center gap-2">
                  <component
                    :is="contextCommandIcon(sub.id)"
                    v-if="contextCommandIcon(sub.id)"
                    class="size-3.5 shrink-0 text-muted"
                  />
                  <span class="truncate">{{ sub.label }}</span>
                </span>
                <AppShortcutText v-if="sub.shortcut">{{ sub.shortcut }}</AppShortcutText>
              </template>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
      <ContextMenuItem
        v-else
        v-test-id="contextCommandTestId(item.id)"
        :class="canvasMenuItemClass(item.label, cls)"
        :disabled="item.disabled"
        @select="item.action?.()"
      >
        <span class="flex min-w-0 flex-1 items-center gap-2">
          <component
            :is="contextCommandIcon(item.id)"
            v-if="contextCommandIcon(item.id)"
            class="size-3.5 shrink-0 text-muted"
          />
          <span class="truncate">{{ item.label }}</span>
        </span>
        <span
          v-if="item.shortcut"
          class="text-[11px]"
          :class="canvasMenuShortcutClass(item.label)"
          >{{ item.shortcut }}</span
        >
      </ContextMenuItem>
    </template>
  </ContextMenuContent>
</template>
