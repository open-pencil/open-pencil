<script setup lang="ts">
import { templateRef } from '@vueuse/core'
import {
  DropdownMenuContent,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import { watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import { openSettingsDialog } from '@/app/settings/dialog'
import { useAppMenu } from '@/app/shell/menu/app-menu'
import { useDocumentNameRename } from '@/app/shell/menu/document-name'
import { appMenuShortcutLabel } from '@/app/shell/menu/shortcut'
import { resolvedAppTheme } from '@/app/shell/theme'
import BrandMark from '@/components/brand/BrandMark.vue'
import MainMenuEntries from '@/components/shell/MainMenuEntries.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { useMenuUI } from '@/components/ui/menu/menu'
import MenuScrollArea from '@/components/ui/menu/MenuScrollArea.vue'
import { IS_TAURI } from '@/constants'

const store = useEditorStore()

const { rename, editingName, startRename, commitRename } = useDocumentNameRename(store)
const nameInput = templateRef<HTMLInputElement>('nameInput')

watch(nameInput, (input) => {
  if (input) void rename.focusInput(input)
})

const { menu: t, settings } = useI18n()

// The browser's main menu opens from the logo, as in Figma; the desktop app uses native menus.
const { mainMenu } = useAppMenu()
const mainMenuCls = useMenuUI({ content: 'min-w-52' })
</script>

<template>
  <div class="shrink-0 border-b border-border">
    <div class="flex items-center gap-2 px-2 py-1.5">
      <BrandMark
        v-if="IS_TAURI"
        data-test-id="app-logo"
        variant="app-icon"
        :appearance="resolvedAppTheme"
        class="size-6"
      />
      <DropdownMenuRoot v-else>
        <DropdownMenuTrigger
          :aria-label="t.mainMenu"
          class="-m-0.5 flex shrink-0 cursor-pointer items-center rounded p-0.5 outline-none hover:bg-hover focus-visible:ring-2 focus-visible:ring-accent/40 data-[state=open]:bg-hover"
        >
          <BrandMark
            data-test-id="app-logo"
            variant="app-icon"
            :appearance="resolvedAppTheme"
            class="size-6"
          />
        </DropdownMenuTrigger>
        <DropdownMenuPortal>
          <!-- Focus stays where the chosen action put it, such as a dialog it opened. -->
          <DropdownMenuContent
            :side-offset="4"
            align="start"
            :class="mainMenuCls.content"
            @close-auto-focus.prevent
          >
            <MenuScrollArea>
              <MainMenuEntries :entries="mainMenu" />
            </MenuScrollArea>
          </DropdownMenuContent>
        </DropdownMenuPortal>
      </DropdownMenuRoot>
      <input
        v-if="editingName"
        ref="nameInput"
        data-test-id="app-document-name-input"
        class="min-w-0 flex-1 rounded border border-accent bg-input px-1 py-0.5 text-xs text-surface outline-none"
        :value="store.state.documentName"
        @blur="commitRename($event)"
        @keydown="rename.onKeydown"
      />
      <span
        v-else
        data-test-id="app-document-name"
        class="min-w-0 flex-1 cursor-default truncate rounded px-1 py-0.5 text-xs text-surface hover:bg-hover"
        @dblclick="startRename"
        >{{ store.state.documentName }}</span
      >
      <IconButton
        :label="settings.title"
        data-test-id="app-settings-trigger"
        @click="openSettingsDialog()"
      >
        <icon-lucide-settings class="size-3.5" />
      </IconButton>
      <IconButton
        :label="`${t.toggleUI} (${appMenuShortcutLabel('toggle-ui')})`"
        data-test-id="app-toggle-ui"
        @click="store.state.showUI = !store.state.showUI"
      >
        <icon-lucide-sidebar class="size-3.5" />
      </IconButton>
    </div>
  </div>
</template>
