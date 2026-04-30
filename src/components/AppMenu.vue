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

import { useI18n } from '@open-pencil/vue'
import { useMenuUI } from '@/components/ui/menu'
import { IS_TAURI } from '@/constants'
import { useAppMenu } from '@/app/shell/menu/app-menu'
import { useDocumentNameRename } from '@/app/shell/menu/document-name'
import {
  hasMenuSubItems,
  isMenuCheckbox,
  isMenuSeparator,
  menuChecked,
  menuDisabled,
  menuLabel,
  menuShortcut,
  menuSubItems,
  runMenuAction,
  updateMenuChecked
} from '@/app/shell/menu/entry'
import { useEditorStore } from '@/app/editor/active-store'

const store = useEditorStore()

const { rename, editingName, setNameInputRef, startRename, commitRename } =
  useDocumentNameRename(store)

const isMac = navigator.platform.includes('Mac')
const mod = isMac ? '⌘' : 'Ctrl+'
const { menu: t } = useI18n()

const { topMenus } = useAppMenu(mod)
const menuCls = useMenuUI()
const mainMenuCls = useMenuUI({ content: 'min-w-52' })
const subMenuCls = useMenuUI({ content: 'min-w-44' })
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
      <Tip :label="`${t.toggleUI} (${mod}\\)`">
        <button
          data-test-id="app-toggle-ui"
          class="flex size-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-hover hover:text-surface"
          @click="store.state.showUI = !store.state.showUI"
        >
          <icon-lucide-sidebar class="size-3.5" />
        </button>
      </Tip>
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
            <MenubarContent :side-offset="4" align="start" :class="mainMenuCls.content">
              <template v-for="(item, i) in menu.items" :key="i">
                <MenubarSeparator v-if="isMenuSeparator(item)" :class="menuCls.separator" />
                <MenubarSub v-else-if="hasMenuSubItems(item)">
                  <MenubarSubTrigger :class="menuCls.item">
                    <span class="flex-1">{{ menuLabel(item) }}</span>
                    <IconChevronRight class="size-3 text-muted" />
                  </MenubarSubTrigger>
                  <MenubarPortal>
                    <MenubarSubContent :side-offset="4" :class="subMenuCls.content">
                      <template v-for="(sub, j) in menuSubItems(item)" :key="j">
                        <MenubarSeparator v-if="isMenuSeparator(sub)" :class="menuCls.separator" />
                        <MenubarCheckboxItem
                          v-else-if="isMenuCheckbox(sub)"
                          :model-value="menuChecked(sub)"
                          :class="menuCls.item"
                          @update:model-value="updateMenuChecked(sub, $event as boolean)"
                        >
                          <span class="flex-1">{{ menuLabel(sub) }}</span>
                          <MenubarItemIndicator class="text-surface">
                            <icon-lucide-check class="size-3.5" />
                          </MenubarItemIndicator>
                        </MenubarCheckboxItem>
                        <MenubarItem
                          v-else
                          :class="menuCls.item"
                          :disabled="menuDisabled(sub)"
                          @select="runMenuAction(sub)"
                        >
                          <span class="flex-1">{{ menuLabel(sub) }}</span>
                          <span v-if="menuShortcut(sub)" class="text-[11px] text-muted">{{
                            menuShortcut(sub)
                          }}</span>
                        </MenubarItem>
                      </template>
                    </MenubarSubContent>
                  </MenubarPortal>
                </MenubarSub>
                <MenubarCheckboxItem
                  v-else-if="isMenuCheckbox(item)"
                  :model-value="menuChecked(item)"
                  :class="menuCls.item"
                  @update:model-value="updateMenuChecked(item, $event as boolean)"
                >
                  <span class="flex-1">{{ menuLabel(item) }}</span>
                  <MenubarItemIndicator class="text-surface">
                    <icon-lucide-check class="size-3.5" />
                  </MenubarItemIndicator>
                </MenubarCheckboxItem>
                <MenubarItem
                  v-else
                  :class="menuCls.item"
                  :disabled="menuDisabled(item)"
                  @select="runMenuAction(item)"
                >
                  <span class="flex-1">{{ menuLabel(item) }}</span>
                  <span v-if="menuShortcut(item)" class="text-[11px] text-muted">{{
                    menuShortcut(item)
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
