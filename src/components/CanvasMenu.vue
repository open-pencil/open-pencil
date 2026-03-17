<script setup lang="ts">
import { computed } from 'vue'
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
import { useSelectionState } from '@open-pencil/vue'
import { toast } from '@/utils/toast'

import { useEditorStore } from '@/stores/editor'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'

const store = useEditorStore()
const { copy } = useClipboard()

const {
  editor,
  selectedIds,
  hasSelection,
  selectedCount,
  selectedNode,
  isInstance,
  isComponent,
  isGroup,
  canCreateComponentSet
} = useSelectionState()

const isVisible = computed(() => selectedNode.value?.visible ?? true)
const isLocked = computed(() => selectedNode.value?.locked ?? false)

const otherPages = computed(() =>
  editor.graph.getPages().filter((p) => p.id !== editor.state.currentPageId)
)

function ids() {
  return [...selectedIds.value]
}

function execCommand(cmd: string) {
  window.document.execCommand(cmd)
}

async function clipboardWrite(text: string | null, label: string) {
  if (!text) return
  copy(text)
  toast.show(`Copied as ${label}`)
}

async function copyAsPNG() {
  const data = await store.renderExportImage([...selectedIds.value], 2, 'PNG')
  if (!data) return
  const blob = new Blob([data], { type: 'image/png' })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  toast.show('Copied as PNG')
}

const cls = {
  menu: menuContent({
    class: 'min-w-56 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95'
  }),
  item: menuItem(),
  component: menuItem({ tone: 'component' }),
  sep: menuSeparator({ class: 'my-1' })
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
      @select="editor.duplicateSelected()"
    >
      <span>Duplicate</span><span class="text-[11px] text-muted">⌘D</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="editor.deleteSelected()">
      <span>Delete</span><span class="text-[11px] text-muted">⌫</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="cls.sep" />

    <ContextMenuSub v-if="otherPages.length > 0 && hasSelection">
      <ContextMenuSubTrigger :class="cls.item">
        <span>Move to page</span><span class="text-sm text-muted">›</span>
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent :class="cls.menu">
          <ContextMenuItem
            v-for="page in otherPages"
            :key="page.id"
            :class="cls.item"
            @select="editor.moveToPage(page.id)"
          >
            {{ page.name }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>

    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="editor.bringToFront()">
      <span>Bring to front</span><span class="text-[11px] text-muted">]</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="editor.sendToBack()">
      <span>Send to back</span><span class="text-[11px] text-muted">[</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="cls.sep" />

    <ContextMenuItem
      :class="cls.item"
      :disabled="selectedCount < 2"
      @select="editor.groupSelected()"
    >
      <span>Group</span><span class="text-[11px] text-muted">⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isGroup" :class="cls.item" @select="editor.ungroupSelected()">
      <span>Ungroup</span><span class="text-[11px] text-muted">⇧⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="hasSelection" :class="cls.item" @select="editor.wrapInAutoLayout()">
      <span>Add auto layout</span><span class="text-[11px] text-muted">⇧A</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="cls.sep" />

    <ContextMenuItem
      :class="cls.component"
      :disabled="!hasSelection"
      @select="editor.createComponentFromSelection()"
    >
      <span>Create component</span><span class="text-[11px] text-component/60">⌥⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canCreateComponentSet"
      :class="cls.component"
      @select="editor.createComponentSetFromComponents()"
    >
      <span>Create component set</span><span class="text-[11px] text-component/60">⇧⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isComponent && selectedNode"
      :class="cls.component"
      @select="editor.createInstanceFromComponent(selectedNode.id)"
    >
      <span>Create instance</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isInstance" :class="cls.component" @select="editor.goToMainComponent()">
      <span>Go to main component</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isInstance" :class="cls.item" @select="editor.detachInstance()">
      <span>Detach instance</span><span class="text-[11px] text-muted">⌥⌘B</span>
    </ContextMenuItem>

    <template v-if="hasSelection">
      <ContextMenuSeparator :class="cls.sep" />

      <ContextMenuItem :class="cls.item" @select="editor.toggleVisibility()">
        <span>{{ isVisible ? 'Hide' : 'Show' }}</span
        ><span class="text-[11px] text-muted">⇧⌘H</span>
      </ContextMenuItem>
      <ContextMenuItem :class="cls.item" @select="editor.toggleLock()">
        <span>{{ isLocked ? 'Unlock' : 'Lock' }}</span
        ><span class="text-[11px] text-muted">⇧⌘L</span>
      </ContextMenuItem>

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
