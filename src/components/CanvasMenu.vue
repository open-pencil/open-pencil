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
import { useSelectionState, toast } from '@open-pencil/vue'
import { computed } from 'vue'

import { useEditorStore } from '@/stores/editor'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'

const store = useEditorStore()
const {
  hasSelection,
  selectedNode,
  selectedCount,
  isInstance,
  isComponent,
  isGroup,
  canCreateComponentSet
} = useSelectionState()

const otherPages = computed(() =>
  store.graph.getPages().filter((p) => p.id !== store.state.currentPageId)
)

const isVisible = computed(() => selectedNode.value?.visible ?? true)
const isLocked = computed(() => selectedNode.value?.locked ?? false)

async function copyAsText() {
  const text = store.copySelectionAsText([...store.state.selectedIds])
  await navigator.clipboard.writeText(text)
  toast.show('Copied as text')
}

async function copyAsSVG() {
  const svg = store.copySelectionAsSVG([...store.state.selectedIds])
  if (!svg) return
  await navigator.clipboard.writeText(svg)
  toast.show('Copied as SVG')
}

async function copyAsPNG() {
  const data = await store.renderExportImage([...store.state.selectedIds], 2, 'PNG')
  if (!data) return
  const blob = new Blob([data], { type: 'image/png' })
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  toast.show('Copied as PNG')
}

async function copyAsJSX() {
  const jsx = store.copySelectionAsJSX([...store.state.selectedIds])
  if (!jsx) return
  await navigator.clipboard.writeText(jsx)
  toast.show('Copied as JSX')
}

function execCommand(cmd: string) {
  window.document.execCommand(cmd)
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
      @select="store.duplicateSelected()"
    >
      <span>Duplicate</span><span class="text-[11px] text-muted">⌘D</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="store.deleteSelected()">
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
            @select="store.moveToPage(page.id)"
          >
            {{ page.name }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>

    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="store.bringToFront()">
      <span>Bring to front</span><span class="text-[11px] text-muted">]</span>
    </ContextMenuItem>
    <ContextMenuItem :class="cls.item" :disabled="!hasSelection" @select="store.sendToBack()">
      <span>Send to back</span><span class="text-[11px] text-muted">[</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="cls.sep" />

    <ContextMenuItem
      :class="cls.item"
      :disabled="selectedCount < 2"
      @select="store.groupSelected()"
    >
      <span>Group</span><span class="text-[11px] text-muted">⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isGroup" :class="cls.item" @select="store.ungroupSelected()">
      <span>Ungroup</span><span class="text-[11px] text-muted">⇧⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="hasSelection" :class="cls.item" @select="store.wrapInAutoLayout()">
      <span>Add auto layout</span><span class="text-[11px] text-muted">⇧A</span>
    </ContextMenuItem>

    <ContextMenuSeparator :class="cls.sep" />

    <ContextMenuItem
      :class="cls.component"
      :disabled="!hasSelection"
      @select="store.createComponentFromSelection()"
    >
      <span>Create component</span><span class="text-[11px] text-component/60">⌥⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canCreateComponentSet"
      :class="cls.component"
      @select="store.createComponentSetFromComponents()"
    >
      <span>Create component set</span><span class="text-[11px] text-component/60">⇧⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isComponent && selectedNode"
      :class="cls.component"
      @select="store.createInstanceFromComponent(selectedNode.id)"
    >
      <span>Create instance</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isInstance" :class="cls.component" @select="store.goToMainComponent()">
      <span>Go to main component</span>
    </ContextMenuItem>
    <ContextMenuItem v-if="isInstance" :class="cls.item" @select="store.detachInstance()">
      <span>Detach instance</span><span class="text-[11px] text-muted">⌥⌘B</span>
    </ContextMenuItem>

    <template v-if="hasSelection">
      <ContextMenuSeparator :class="cls.sep" />

      <ContextMenuItem :class="cls.item" @select="store.toggleVisibility()">
        <span>{{ isVisible ? 'Hide' : 'Show' }}</span
        ><span class="text-[11px] text-muted">⇧⌘H</span>
      </ContextMenuItem>
      <ContextMenuItem :class="cls.item" @select="store.toggleLock()">
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
            <ContextMenuItem :class="cls.item" @select="copyAsText">Copy as text</ContextMenuItem>
            <ContextMenuItem :class="cls.item" @select="copyAsSVG">Copy as SVG</ContextMenuItem>
            <ContextMenuItem :class="cls.item" @select="copyAsPNG">
              <span>Copy as PNG</span><span class="text-[11px] text-muted">⇧⌘C</span>
            </ContextMenuItem>
            <ContextMenuItem :class="cls.item" @select="copyAsJSX">Copy as JSX</ContextMenuItem>
          </ContextMenuSubContent>
        </ContextMenuPortal>
      </ContextMenuSub>
    </template>
  </ContextMenuContent>
</template>
