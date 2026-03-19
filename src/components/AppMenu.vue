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
import { useI18n } from 'vue-i18n'

import { useInlineRename } from '@/composables/use-inline-rename'
import { menuContent, menuItem, menuSeparator } from '@/components/ui/menu'
import { IS_TAURI } from '@/constants'
import { openFileDialog } from '@/composables/use-menu'
import { useEditorStore } from '@/stores/editor'
import LanguageSelector from './LanguageSelector.vue'

const store = useEditorStore()
const { t } = useI18n()

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
    label: t('menu.file.new'),
    shortcut: `${mod}N`,
    action: () => import('@/stores/tabs').then((m) => m.createTab())
  },
  { label: t('menu.file.open'), shortcut: `${mod}O`, action: () => openFileDialog() },
  { separator: true },
  { label: t('menu.file.save'), shortcut: `${mod}S`, action: () => store.saveFigFile() },
  { label: t('menu.file.saveAs'), shortcut: `${mod}⇧S`, action: () => store.saveFigFileAs() },
  { separator: true },
  {
    label: t('menu.file.exportSelection'),
    shortcut: `${mod}⇧E`,
    action: () => {
      if (store.state.selectedIds.size > 0) store.exportSelection(1, 'PNG')
    },
    disabled: store.state.selectedIds.size === 0
  },
  { separator: true },
  {
    label: t('menu.file.autoSave'),
    get checked() {
      return store.state.autosaveEnabled
    },
    onCheckedChange: (v: boolean) => {
      store.state.autosaveEnabled = v
    }
  }
]

const editMenu: MenuItem[] = [
  { label: t('menu.edit.undo'), shortcut: `${mod}Z`, action: () => store.undoAction() },
  { label: t('menu.edit.redo'), shortcut: `${mod}⇧Z`, action: () => store.redoAction() },
  { separator: true },
  { label: t('menu.edit.copy'), shortcut: `${mod}C` },
  { label: t('menu.edit.paste'), shortcut: `${mod}V` },
  { label: t('menu.edit.duplicate'), shortcut: `${mod}D`, action: () => store.duplicateSelected() },
  { label: t('menu.edit.delete'), shortcut: '⌫', action: () => store.deleteSelected() },
  { separator: true },
  { label: t('menu.edit.selectAll'), shortcut: `${mod}A`, action: () => store.selectAll() }
]

const viewMenu: MenuItem[] = [
  { label: t('menu.view.zoomTo100'), shortcut: `${mod}0`, action: () => store.zoomTo100() },
  { label: t('menu.view.zoomToFit'), shortcut: `${mod}1`, action: () => store.zoomToFit() },
  { label: t('menu.view.zoomToSelection'), shortcut: `${mod}2`, action: () => store.zoomToSelection() },
  {
    label: t('menu.view.zoomIn'),
    shortcut: `${mod}=`,
    action: () => store.applyZoom(-100, window.innerWidth / 2, window.innerHeight / 2)
  },
  {
    label: t('menu.view.zoomOut'),
    shortcut: `${mod}-`,
    action: () => store.applyZoom(100, window.innerWidth / 2, window.innerHeight / 2)
  },
  { separator: true },
  {
    label: t('menu.view.performanceProfiler'),
    get checked() {
      return store.renderer?.profiler.hudVisible ?? false
    },
    onCheckedChange: () => {
      store.toggleProfiler()
    }
  }
]

const objectMenu: MenuItem[] = [
  { label: t('menu.object.group'), shortcut: `${mod}G`, action: () => store.groupSelected() },
  { label: t('menu.object.ungroup'), shortcut: `${mod}⇧G`, action: () => store.ungroupSelected() },
  { separator: true },
  {
    label: t('menu.object.createComponent'),
    shortcut: `${mod}⌥K`,
    action: () => store.createComponentFromSelection()
  },
  {
    label: t('menu.object.createComponentSet'),
    action: () => store.createComponentSetFromComponents()
  },
  { label: t('menu.object.detachInstance'), action: () => store.detachInstance() },
  { separator: true },
  { label: t('menu.object.bringToFront'), shortcut: ']', action: () => store.bringToFront() },
  { label: t('menu.object.sendToBack'), shortcut: '[', action: () => store.sendToBack() }
]

const textMenu: MenuItem[] = [
  { label: t('menu.text.bold'), shortcut: `${mod}B` },
  { label: t('menu.text.italic'), shortcut: `${mod}I` },
  { label: t('menu.text.underline'), shortcut: `${mod}U` }
]

const arrangeMenu: MenuItem[] = [
  { label: t('menu.arrange.addAutoLayout'), shortcut: '⇧A', action: () => store.wrapInAutoLayout() },
  { separator: true },
  { label: t('menu.arrange.alignLeft'), shortcut: '⌥A' },
  { label: t('menu.arrange.alignCenter'), shortcut: '⌥H' },
  { label: t('menu.arrange.alignRight'), shortcut: '⌥D' },
  { separator: true },
  { label: t('menu.arrange.alignTop'), shortcut: '⌥W' },
  { label: t('menu.arrange.alignMiddle'), shortcut: '⌥V' },
  { label: t('menu.arrange.alignBottom'), shortcut: '⌥S' }
]

const topMenus = [
  { label: t('menu.file.label'), items: fileMenu },
  { label: t('menu.edit.label'), items: editMenu },
  { label: t('menu.view.label'), items: viewMenu },
  { label: t('menu.object.label'), items: objectMenu },
  { label: t('menu.text.label'), items: textMenu },
  { label: t('menu.arrange.label'), items: arrangeMenu }
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
      <MenubarRoot class="scrollbar-none flex items-center gap-0.5 overflow-x-auto">
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
        <MenubarMenu>
          <MenubarTrigger
            data-test-id="menubar-language"
            class="flex cursor-pointer items-center rounded px-2 py-1 text-xs text-muted transition-colors select-none hover:bg-hover hover:text-surface data-[state=open]:bg-hover data-[state=open]:text-surface"
          >
            {{ t('menu.language.label') }}
          </MenubarTrigger>
          <MenubarPortal>
            <MenubarContent :side-offset="4" :class="menuContent({ class: 'min-w-36' })">
              <LanguageSelector />
            </MenubarContent>
          </MenubarPortal>
        </MenubarMenu>
      </MenubarRoot>
    </div>
  </div>
</template>
