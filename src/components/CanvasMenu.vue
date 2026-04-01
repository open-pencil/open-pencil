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
import { useClipboard } from '@vueuse/core'
import { useEditorCommands, useMenuModel, useSelectionState } from '@open-pencil/vue'
import { toast } from '@/utils/toast'

import { useEditorStore } from '@/stores/editor'
import { menu, useMenuUI } from '@/components/ui/menu'

const store = useEditorStore()
const { copy } = useClipboard()

const { editor, selectedIds, hasSelection } = useSelectionState()
const { getCommand } = useEditorCommands()
const { canvasMenu } = useMenuModel()

function ids() {
  return [...selectedIds.value]
}

function execCommand(cmd: 'copy' | 'cut' | 'paste') {
  try {
    if (window.document.execCommand(cmd)) return
  } catch (error) {
    console.warn(`Clipboard command ${cmd} failed`, error)
  }

  toast.show('Clipboard access is blocked in this browser context', 'error')
}

async function clipboardWrite(text: string | null, label: string) {
  if (!text) return
  copy(text)
  toast.show(`Copied as ${label}`)
}

async function copyAsPNG() {
  if (!navigator.clipboard?.write || typeof ClipboardItem === 'undefined') {
    toast.show('PNG clipboard export is not available in this browser', 'error')
    return
  }
  const data = await store.renderExportImage([...selectedIds.value], 2, 'PNG')
  if (!data) return
  const blob = new Blob([data], { type: 'image/png' })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  toast.show('Copied as PNG')
}

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
      <span>Copy</span><span class="text-[11px] text-muted">⌘C</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="execCommand('cut')">
      <span>Cut</span><span class="text-[11px] text-muted">⌘X</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" @select="execCommand('paste')">
      <span>Paste here</span><span class="text-[11px] text-muted">⌘V</span>
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
        :class="
          item.label.includes('component') || item.label.includes('instance')
            ? cls.component
            : cls.item
        "
        :disabled="item.disabled"
        @select="item.action?.()"
      >
        <span class="flex-1">{{ item.label }}</span>
        <span
          v-if="item.shortcut"
          class="text-[11px]"
          :class="
            item.label.includes('component') || item.label.includes('instance')
              ? 'text-component/60'
              : 'text-muted'
          "
          >{{ item.shortcut }}</span
        >
      </ContextMenuItem>
    </template>

    <template v-if="hasSelection">
      <ContextMenuSeparator :class="cls.sep" />

      <ContextMenuSub>
        <ContextMenuSubTrigger :class="cls.item">
          <span>Copy/Paste as</span><span class="text-sm text-muted">›</span>
        </ContextMenuSubTrigger>
        <ContextMenuPortal>
          <ContextMenuSubContent :class="cls.menu">
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsText(ids()), 'text')"
              >Copy as text</ContextMenuItem
            >
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsSVG(ids()), 'SVG')"
              >Copy as SVG</ContextMenuItem
            >
            <ContextMenuItem :class="cls.item" @select="copyAsPNG">
              <span>Copy as PNG</span><span class="text-[11px] text-muted">⇧⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem
              :class="cls.item"
              @select="clipboardWrite(editor.copySelectionAsJSX(ids()), 'JSX')"
              >Copy as JSX</ContextMenuItem
            >
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
    </template>
  </ContextMenuContent>
</template>
