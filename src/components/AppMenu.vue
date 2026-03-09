<script setup lang="ts">
import {
  MenubarCheckboxItem,
  MenubarContent,
  MenubarItem,
  MenubarItemIndicator,
  MenubarMenu,
  MenubarPortal,
  MenubarRoot,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger
} from 'reka-ui'

import IconChevronRight from '~icons/lucide/chevron-right'

import { computed, ref } from 'vue'

import { useInlineRename } from '@/composables/use-inline-rename'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'
import { IS_TAURI } from '@/constants'
import { openFileDialog } from '@/composables/use-menu'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const DOCUMENT_NAME_ID = 'document-name'
const rename = useInlineRename<'document-name'>((_id, name) => {
  store.state.documentName = name
})
const editingName = computed(() => rename.editingId.value === DOCUMENT_NAME_ID)

function setNameInputRef(el: HTMLInputElement | null) {
  if (el) void rename.focusInput(el)
}

function startRename() {
  rename.start(DOCUMENT_NAME_ID, store.state.documentName)
}

function commitRename(input: HTMLInputElement) {
  rename.commit(DOCUMENT_NAME_ID, input)
}

const isMac = navigator.platform.includes('Mac')
const mod = isMac ? '⌘' : 'Ctrl+'

interface MenuItem {
  label: string
  shortcut?: string
  action?: () => void
  separator?: boolean
  disabled?: boolean
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  sub?: MenuItem[]
}

const fileMenu: MenuItem[] = [
  {
    label: 'New',
    shortcut: `${mod}N`,
    action: () => import('@/stores/tabs').then((m) => m.createTab())
  },
  { label: 'Open…', shortcut: `${mod}O`, action: () => openFileDialog() },
  { separator: true },
  { label: 'Save', shortcut: `${mod}S`, action: () => store.saveFigFile() },
  { label: 'Save as…', shortcut: `${mod}⇧S`, action: () => store.saveFigFileAs() },
  { separator: true },
  {
    label: 'Export selection…',
    shortcut: `${mod}⇧E`,
    action: () => {
      if (store.state.selectedIds.size > 0) store.exportSelection(1, 'PNG')
    },
    disabled: store.state.selectedIds.size === 0
  },
  { separator: true },
  {
    label: 'Auto-save to local file',
    get checked() {
      return store.state.autosaveEnabled
    },
    onCheckedChange: (v: boolean) => {
      store.state.autosaveEnabled = v
    }
  }
]

const editMenu: MenuItem[] = [
  { label: 'Undo', shortcut: `${mod}Z`, action: () => store.undoAction() },
  { label: 'Redo', shortcut: `${mod}⇧Z`, action: () => store.redoAction() },
  { separator: true },
  { label: 'Copy', shortcut: `${mod}C` },
  { label: 'Paste', shortcut: `${mod}V` },
  { label: 'Duplicate', shortcut: `${mod}D`, action: () => store.duplicateSelected() },
  { label: 'Delete', shortcut: '⌫', action: () => store.deleteSelected() },
  { separator: true },
  { label: 'Select all', shortcut: `${mod}A`, action: () => store.selectAll() }
]

const viewMenu: MenuItem[] = [
  { label: 'Zoom to 100%', shortcut: `${mod}0`, action: () => store.zoomTo100() },
  { label: 'Zoom to fit', shortcut: `${mod}1`, action: () => store.zoomToFit() },
  { label: 'Zoom to selection', shortcut: `${mod}2`, action: () => store.zoomToSelection() },
  {
    label: 'Zoom in',
    shortcut: `${mod}=`,
    action: () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2)
  },
  {
    label: 'Zoom out',
    shortcut: `${mod}-`,
    action: () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2)
  },
  { separator: true },
  {
    label: 'Performance profiler',
    get checked() {
      return store.renderer?.profiler.hudVisible ?? false
    },
    onCheckedChange: () => {
      store.toggleProfiler()
    }
  }
]

const objectMenu: MenuItem[] = [
  { label: 'Group', shortcut: `${mod}G`, action: () => store.groupSelected() },
  { label: 'Ungroup', shortcut: `${mod}⇧G`, action: () => store.ungroupSelected() },
  { separator: true },
  {
    label: 'Create component',
    shortcut: `${mod}⌥K`,
    action: () => store.createComponentFromSelection()
  },
  {
    label: 'Create component set',
    action: () => store.createComponentSetFromComponents()
  },
  { label: 'Detach instance', action: () => store.detachInstance() },
  { separator: true },
  { label: 'Bring to front', shortcut: ']', action: () => store.bringToFront() },
  { label: 'Send to back', shortcut: '[', action: () => store.sendToBack() }
]

const textMenu: MenuItem[] = [
  { label: 'Bold', shortcut: `${mod}B` },
  { label: 'Italic', shortcut: `${mod}I` },
  { label: 'Underline', shortcut: `${mod}U` }
]

const arrangeMenu: MenuItem[] = [
  { label: 'Add auto layout', shortcut: '⇧A', action: () => store.wrapInAutoLayout() },
  { separator: true },
  { label: 'Align left', shortcut: '⌥A' },
  { label: 'Align center', shortcut: '⌥H' },
  { label: 'Align right', shortcut: '⌥D' },
  { separator: true },
  { label: 'Align top', shortcut: '⌥W' },
  { label: 'Align middle', shortcut: '⌥V' },
  { label: 'Align bottom', shortcut: '⌥S' }
]

const topMenus = [
  { label: 'File', items: fileMenu },
  { label: 'Edit', items: editMenu },
  { label: 'View', items: viewMenu },
  { label: 'Object', items: objectMenu },
  { label: 'Text', items: textMenu },
  { label: 'Arrange', items: arrangeMenu }
]
</script>

<template>
  <div class="shrink-0 border-b border-border">
    <div class="flex items-center gap-2 px-2 py-1.5">
      <img data-test-id="app-logo" src="/favicon-32.png" class="size-4" alt="OpenPencil" />
      <input
        v-if="editingName"
        :ref="(el) => setNameInputRef(el as HTMLInputElement | null)"
        data-test-id="app-document-name-input"
        class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-xs text-surface outline-none"
        :value="store.state.documentName"
        @blur="commitRename($event.target as HTMLInputElement)"
        @keydown.enter="($event.target as HTMLInputElement).blur()"
        @keydown="rename.onKeydown"
      />
      <span
        v-else
        data-test-id="app-document-name"
        class="min-w-0 flex-1 cursor-default truncate rounded px-1 py-0.5 text-xs text-surface hover:bg-hover"
        @dblclick="startRename"
        >{{ store.state.documentName }}</span
      >
      <button
        data-test-id="app-toggle-ui"
        class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
        title="Toggle UI (⌘\)"
        @click="store.state.showUI = !store.state.showUI"
      >
        <icon-lucide-sidebar class="size-3.5" />
      </button>
    </div>
    <div v-if="!IS_TAURI" class="flex items-center px-1 pb-1">
      <MenubarRoot class="flex items-center gap-0.5 overflow-x-auto scrollbar-none">
        <MenubarMenu v-for="menu in topMenus" :key="menu.label">
          <MenubarTrigger
            :data-test-id="`menubar-${menu.label.toLowerCase()}`"
            class="flex cursor-pointer items-center rounded px-2 py-1 text-xs text-muted transition-colors select-none hover:bg-hover hover:text-surface data-[state=open]:bg-hover data-[state=open]:text-surface"
          >
            {{ menu.label }}
          </MenubarTrigger>

          <MenubarPortal>
            <MenubarContent
              :side-offset="4"
              align="start"
              :class="menuContent({ class: 'min-w-52' })"
            >
              <template v-for="(item, i) in menu.items" :key="i">
                <MenubarSeparator v-if="item.separator" :class="menuSeparator()" />
                <MenubarSub v-else-if="item.sub">
                  <MenubarSubTrigger :class="menuItem()">
                    <span class="flex-1">{{ item.label }}</span>
                    <IconChevronRight class="size-3 text-muted" />
                  </MenubarSubTrigger>
                  <MenubarPortal>
                    <MenubarSubContent :side-offset="4" :class="menuContent({ class: 'min-w-44' })">
                      <template v-for="(sub, j) in item.sub" :key="j">
                        <MenubarSeparator v-if="sub.separator" :class="menuSeparator()" />
                        <MenubarItem
                          v-else
                          :class="menuItem()"
                          :disabled="sub.disabled"
                          @select="sub.action?.()"
                        >
                          <span class="flex-1">{{ sub.label }}</span>
                          <span v-if="sub.shortcut" class="text-[11px] text-muted">{{
                            sub.shortcut
                          }}</span>
                        </MenubarItem>
                      </template>
                    </MenubarSubContent>
                  </MenubarPortal>
                </MenubarSub>
                <MenubarCheckboxItem
                  v-else-if="item.onCheckedChange"
                  :model-value="item.checked"
                  :class="menuItem()"
                  @update:model-value="item.onCheckedChange?.($event as boolean)"
                >
                  <span class="flex-1">{{ item.label }}</span>
                  <MenubarItemIndicator class="text-surface">
                    <icon-lucide-check class="size-3.5" />
                  </MenubarItemIndicator>
                </MenubarCheckboxItem>
                <MenubarItem
                  v-else
                  :class="menuItem()"
                  :disabled="item.disabled"
                  @select="item.action?.()"
                >
                  <span class="flex-1">{{ item.label }}</span>
                  <span v-if="item.shortcut" class="text-[11px] text-muted">{{
                    item.shortcut
                  }}</span>
                </MenubarItem>
              </template>
            </MenubarContent>
          </MenubarPortal>
        </MenubarMenu>
      </MenubarRoot>
    </div>
  </div>
</template>
