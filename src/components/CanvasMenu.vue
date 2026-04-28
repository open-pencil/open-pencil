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
import { useEditorCommands, useI18n, useMenuModel, useSelectionState } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { createCanvasMenuActions } from '@/app/editor/canvas/menu-actions'
import { canvasMenuItemClass, canvasMenuShortcutClass } from '@/app/editor/canvas/menu-model'
import { menu, useMenuUI } from '@/components/ui/menu'

const store = useEditorStore()

const { editor, selectedIds, hasSelection } = useSelectionState()
const { getCommand } = useEditorCommands()
const { canvasMenu } = useMenuModel()
const { menu: t } = useI18n()

const { ids, execCommand, clipboardWrite, copyNodeId, copyXPath, copyAsPNG } =
  createCanvasMenuActions(store, selectedIds)

const menuCls = useMenuUI({
  content: 'min-w-56 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95',
  separator: 'my-1'
})
const componentMenu = menu({ tone: 'component' })

const cls = {
  menu: menuCls.content,
  item: menuCls.item,
  component: componentMenu.item(),
  sep: menuCls.separator
}
</script>

<template>
  <ContextMenuContent :class="cls.menu" :side-offset="2" align="start">
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="execCommand('copy')">
      <span>{{ t.copy }}</span
      ><span class="text-[11px] text-muted">⌘C</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="execCommand('cut')">
      <span>{{ t.cut }}</span
      ><span class="text-[11px] text-muted">⌘X</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" @select="execCommand('paste')">
      <span>{{ t.pasteHere }}</span
      ><span class="text-[11px] text-muted">⌘V</span>
    </ContextMenuItem>
    <ContextMenuItem
      :class="cls.item"
      :disabled="!hasSelection"
      @select="getCommand('selection.duplicate').run()"
    >
      <span>Duplicate</span><span class="text-[11px] text-muted">⌘D</span>
    </ContextMenuItem>
    <ContextMenuItem
      :class="cls.item"
      :disabled="!hasSelection"
      @select="getCommand('selection.delete').run()"
    >
      <span>Delete</span><span class="text-[11px] text-muted">⌫</span>
    </ContextMenuItem>

    <template v-for="(item, i) in canvasMenu" :key="`menu-${i}`">
      <ContextMenuSeparator v-if="item.separator" :class="cls.sep" />
      <ContextMenuSub v-else-if="item.sub">
        <ContextMenuSubTrigger :class="cls.item">
          <span>{{ item.label }}</span
          ><span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="cls.menu">
            <ContextMenuItem
              v-for="(sub, j) in item.sub"
              :key="j"
              :class="cls.item"
              :disabled="sub.separator ? true : sub.disabled"
              @select="!sub.separator && sub.action?.()"
            >
              <template v-if="!sub.separator">
                <span class="flex-1">{{ sub.label }}</span>
                <span v-if="sub.shortcut" class="text-[11px] text-muted">{{ sub.shortcut }}</span>
              </template>
            </ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
      <ContextMenuItem
        v-else
        :class="canvasMenuItemClass(item.label, cls)"
        :disabled="item.disabled"
        @select="item.action?.()"
      >
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="text-[11px]"
          :class="canvasMenuShortcutClass(item.label)"
          >{{ item.shortcut }}</span
        >
      </ContextMenuItem>
    </template>

    <template v-if="hasSelection">
      <ContextMenuSeparator :class="cls.sep" />

      <ContextMenuSub>
        <ContextMenuSubTrigger :class="cls.item">
          <span>{{ t.copyPasteAs }}</span
          ><span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="cls.menu">
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsText(ids()), 'text')"
              >{{ t.copyAsText }}</ContextMenuItem
            >
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsSVG(ids()), 'SVG')"
              >{{ t.copyAsSVG }}</ContextMenuItem
            >
            <ContextMenuItem :class="cls.item" @select="copyAsPNG">
              <span>{{ t.copyAsPNG }}</span
              ><span class="text-[11px] text-muted">⇧⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsJSX(ids()), 'JSX')"
              >{{ t.copyAsJSX }}</ContextMenuItem
            >
            <ContextMenuItem :class="cls.item" @select="copyNodeId">{{
              t.copyNodeId
            }}</ContextMenuItem>
            <ContextMenuItem :class="cls.item" @select="copyXPath">{{
              t.copyXPath
            }}</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
    </template>
  </ContextMenuContent>
</template>
