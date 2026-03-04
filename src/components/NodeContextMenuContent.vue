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

import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const hasSelection = computed(() => {
  void store.state.sceneVersion
  return store.state.selectedIds.size > 0
})

const singleNode = computed(() => {
  void store.state.sceneVersion
  if (store.state.selectedIds.size !== 1) return null
  const id = [...store.state.selectedIds][0]
  return store.graph.getNode(id) ?? null
})

const multiCount = computed(() => {
  void store.state.sceneVersion
  return store.state.selectedIds.size
})

const isInstance = computed(() => singleNode.value?.type === 'INSTANCE')
const isComponent = computed(() => singleNode.value?.type === 'COMPONENT')
const isGroup = computed(() => singleNode.value?.type === 'GROUP')

const canCreateComponentSet = computed(() => {
  void store.state.sceneVersion
  if (store.state.selectedIds.size < 2) return false
  return [...store.state.selectedIds].every((id) => {
    const n = store.graph.getNode(id)
    return n?.type === 'COMPONENT'
  })
})

const otherPages = computed(() => {
  void store.state.sceneVersion
  return store.graph.getPages().filter((p) => p.id !== store.state.currentPageId)
})

const isVisible = computed(() => {
  void store.state.sceneVersion
  if (!singleNode.value) return true
  return singleNode.value.visible
})

const isLocked = computed(() => {
  void store.state.sceneVersion
  if (!singleNode.value) return false
  return singleNode.value.locked
})

const itemClass =
  'flex w-full cursor-pointer select-none items-center justify-between gap-6 rounded px-2 py-1.5 text-xs text-surface outline-none data-[highlighted]:bg-hover data-[disabled]:cursor-default data-[disabled]:text-muted'
const componentItemClass =
  'flex w-full cursor-pointer select-none items-center justify-between gap-6 rounded px-2 py-1.5 text-xs text-[#9747ff] outline-none data-[highlighted]:bg-[#9747ff]/12 data-[disabled]:cursor-default data-[disabled]:text-[#9747ff]/40'
const menuClass =
  'z-50 min-w-56 rounded-lg border border-border bg-panel p-1 shadow-[0_8px_30px_rgb(0_0_0/0.4)] animate-in fade-in zoom-in-95'
</script>

<template>
  <ContextMenuContent :class="menuClass" :side-offset="2" align="start">
    <ContextMenuItem
      data-test-id="context-copy"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="document.execCommand('copy')"
    >
      <span>Copy</span>
      <span class="text-[11px] text-muted">⌘C</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-cut"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="document.execCommand('cut')"
    >
      <span>Cut</span>
      <span class="text-[11px] text-muted">⌘X</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-paste"
      :class="itemClass"
      @select="document.execCommand('paste')"
    >
      <span>Paste here</span>
      <span class="text-[11px] text-muted">⌘V</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-duplicate"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.duplicateSelected()"
    >
      <span>Duplicate</span>
      <span class="text-[11px] text-muted">⌘D</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-delete"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.deleteSelected()"
    >
      <span>Delete</span>
      <span class="text-[11px] text-muted">⌫</span>
    </ContextMenuItem>

    <ContextMenuSeparator class="my-1 h-px bg-border" />

    <ContextMenuSub v-if="otherPages.length > 0 && hasSelection">
      <ContextMenuSubTrigger data-test-id="context-move-to-page" :class="itemClass">
        <span>Move to page</span>
        <span class="text-sm text-muted">›</span>
      </ContextMenuSubTrigger>
      <ContextMenuPortal>
        <ContextMenuSubContent :class="menuClass">
          <ContextMenuItem
            v-for="page in otherPages"
            :key="page.id"
            :class="itemClass"
            @select="store.moveToPage(page.id)"
          >
            {{ page.name }}
          </ContextMenuItem>
        </ContextMenuSubContent>
      </ContextMenuPortal>
    </ContextMenuSub>

    <ContextMenuItem
      data-test-id="context-bring-to-front"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.bringToFront()"
    >
      <span>Bring to front</span>
      <span class="text-[11px] text-muted">]</span>
    </ContextMenuItem>
    <ContextMenuItem
      data-test-id="context-send-to-back"
      :class="itemClass"
      :disabled="!hasSelection"
      @select="store.sendToBack()"
    >
      <span>Send to back</span>
      <span class="text-[11px] text-muted">[</span>
    </ContextMenuItem>

    <ContextMenuSeparator class="my-1 h-px bg-border" />

    <ContextMenuItem
      data-test-id="context-group"
      :class="itemClass"
      :disabled="multiCount < 2"
      @select="store.groupSelected()"
    >
      <span>Group</span>
      <span class="text-[11px] text-muted">⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isGroup"
      data-test-id="context-ungroup"
      :class="itemClass"
      @select="store.ungroupSelected()"
    >
      <span>Ungroup</span>
      <span class="text-[11px] text-muted">⇧⌘G</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="hasSelection"
      data-test-id="context-auto-layout"
      :class="itemClass"
      @select="store.wrapInAutoLayout()"
    >
      <span>Add auto layout</span>
      <span class="text-[11px] text-muted">⇧A</span>
    </ContextMenuItem>

    <ContextMenuSeparator class="my-1 h-px bg-border" />

    <ContextMenuItem
      data-test-id="context-create-component"
      :class="componentItemClass"
      :disabled="!hasSelection"
      @select="store.createComponentFromSelection()"
    >
      <span>Create component</span>
      <span class="text-[11px] text-[#9747ff]/60">⌥⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="canCreateComponentSet"
      data-test-id="context-create-component-set"
      :class="componentItemClass"
      @select="store.createComponentSetFromComponents()"
    >
      <span>Create component set</span>
      <span class="text-[11px] text-[#9747ff]/60">⇧⌘K</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isComponent"
      data-test-id="context-create-instance"
      :class="componentItemClass"
      @select="store.createInstanceFromComponent(singleNode!.id)"
    >
      <span>Create instance</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isInstance"
      data-test-id="context-go-to-component"
      :class="componentItemClass"
      @select="store.goToMainComponent()"
    >
      <span>Go to main component</span>
    </ContextMenuItem>
    <ContextMenuItem
      v-if="isInstance"
      data-test-id="context-detach-instance"
      :class="itemClass"
      @select="store.detachInstance()"
    >
      <span>Detach instance</span>
      <span class="text-[11px] text-muted">⌥⌘B</span>
    </ContextMenuItem>

    <template v-if="hasSelection">
      <ContextMenuSeparator class="my-1 h-px bg-border" />

      <ContextMenuItem
        data-test-id="context-toggle-visibility"
        :class="itemClass"
        @select="store.toggleVisibility()"
      >
        <span>{{ isVisible ? 'Hide' : 'Show' }}</span>
        <span class="text-[11px] text-muted">⇧⌘H</span>
      </ContextMenuItem>
      <ContextMenuItem
        data-test-id="context-toggle-lock"
        :class="itemClass"
        @select="store.toggleLock()"
      >
        <span>{{ isLocked ? 'Unlock' : 'Lock' }}</span>
        <span class="text-[11px] text-muted">⇧⌘L</span>
      </ContextMenuItem>

      <ContextMenuSeparator class="my-1 h-px bg-border" />

      <ContextMenuItem
        data-test-id="context-export-png"
        :class="itemClass"
        @select="store.exportSelection(1, 'PNG')"
      >
        <span>Export as PNG</span>
        <span class="text-[11px] text-muted">⇧⌘E</span>
      </ContextMenuItem>
    </template>
  </ContextMenuContent>
</template>
