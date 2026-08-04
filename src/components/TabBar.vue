<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  TabsList,
  TabsRoot,
  TabsTrigger
} from 'reka-ui'
import { tv } from 'tailwind-variants'

import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import Tip from '@/components/ui/Tip.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu'
import tabBarTheme from '@/theme/tab-bar'
import { setEditorExit, useTabsStore } from '@/app/tabs'
import { createStorageDocument } from '@/app/storage/create-document'
import { useI18n, useInlineRename } from '@open-pencil/vue'

const { dialogs } = useI18n()

const router = useRouter()
const route = useRoute()
const { tabs, activeTabId, switchTab, closeTab, renameTab } = useTabsStore()

/** Home is a view, not an exit: documents stay open while the workspace shows. */
const showingHome = computed(() => route.path === '/')

async function goHome(): Promise<void> {
  await router.push('/')
}

// Closing the last document lands here too.
setEditorExit(goHome)

async function create(sourceFormat: 'fig' | 'deck'): Promise<void> {
  await createStorageDocument(sourceFormat, router)
}

/**
 * Import lives in the workspace, which owns the file picker, the naming and the
 * error surface. Sending the user there beats a second copy of all three.
 */
async function goImport(): Promise<void> {
  await router.push({ path: '/', query: { import: '1' } })
}

/** Returning to a document from the workspace needs the route as well as the tab. */
async function activate(tabId: string): Promise<void> {
  switchTab(tabId)
  if (showingHome.value) await router.push('/editor')
}
const tabBarStyles = tv(tabBarTheme)
const baseStyles = tabBarStyles()
const menuCls = useMenuUI({ content: 'min-w-40' })
const itemCls = menuItem({ justify: 'start', class: 'gap-2' })

const modelValue = computed({
  get: () => (showingHome.value ? '' : activeTabId.value),
  set: (id: string) => void activate(id)
})

/**
 * Inline rename, in the strip rather than a dialog.
 *
 * `useInlineRename` is the app's existing primitive — the editor header used it
 * for the same job before the strip took the name over. It owns Enter, Escape,
 * click-outside and the focus-and-select, which a hand-rolled version got wrong:
 * focusing after an awaited tick dropped the first keystrokes on the floor.
 *
 * The input is deliberately the same box as the label it replaces, so a name too
 * long for the tab scrolls inside it instead of stretching the strip.
 */
const rename = useInlineRename<string>((tabId, name) => void renameTab(tabId, name))
const editingTabId = computed(() => rename.editingId.value)

// A function ref, not a named one. The input sits inside a `v-for`, where Vue
// resolves a string ref to an array rather than to the element, so the focus
// call read `undefined` and silently did nothing.
function bindRenameInput(el: unknown): void {
  if (el instanceof HTMLInputElement) void rename.focusInput(el)
}

function onMiddleClick(e: MouseEvent, tabId: string) {
  if (e.button === 1) {
    e.preventDefault()
    closeTab(tabId)
  }
}

function onClose(e: MouseEvent, tabId: string) {
  e.stopPropagation()
  closeTab(tabId)
}
</script>

<template>
  <!--
    Always rendered. The way back to the workspace lives here now, so hiding the
    strip on a single document would hide navigation with it.
  -->
  <TabsRoot v-model="modelValue" activation-mode="automatic" :class="baseStyles.root()">
    <Tip :label="dialogs.backToStorageWorkspace">
      <button
        type="button"
        data-test-id="app-back-to-workspace"
        :class="tabBarStyles({ active: showingHome }).home()"
        :aria-label="dialogs.backToStorageWorkspace"
        :data-active="showingHome || undefined"
        @click="goHome"
      >
        <icon-lucide-house :class="baseStyles.homeIcon()" />
      </button>
    </Tip>
    <TabsList :class="baseStyles.list()">
      <template v-for="tab in tabs" :key="tab.id">
        <!--
          While renaming, the tab is a plain box rather than a Tabs trigger.
          Nested inside the trigger the input was unusable: a trigger is a
          button, and Tabs claims focus and keystrokes on it as navigation, so
          the first characters went to the tab and the space bar blurred the
          field and committed a half-typed name.
        -->
        <div
          v-if="editingTabId === tab.id"
          data-test-id="tabbar-tab"
          :class="tabBarStyles({ active: true }).trigger()"
        >
          <img :src="storageDocumentIconUrls[tab.format]" alt="" :class="baseStyles.icon()" />
          <input
            :ref="bindRenameInput"
            data-test-id="tabbar-name-input"
            :class="baseStyles.labelInput()"
            :value="tab.name"
            @blur="rename.commit(tab.id, $event)"
            @keydown.stop="rename.onKeydown"
          />
        </div>
        <TabsTrigger
          v-else
          :value="tab.id"
          data-test-id="tabbar-tab"
          :class="tabBarStyles({ active: tab.isActive && !showingHome }).trigger()"
          :data-active="(tab.isActive && !showingHome) || undefined"
          @mousedown="onMiddleClick($event, tab.id)"
          @click="void activate(tab.id)"
        >
          <img :src="storageDocumentIconUrls[tab.format]" alt="" :class="baseStyles.icon()" />
          <span :class="baseStyles.label()" @dblclick.stop="rename.start(tab.id, tab.name)">{{
            tab.name
          }}</span>
          <Tip :label="dialogs.closeTab({ name: tab.name })">
            <button
              data-test-id="tabbar-close"
              :class="tabBarStyles({ active: tab.isActive }).close()"
              :data-active="tab.isActive || undefined"
              :aria-label="dialogs.closeTab({ name: tab.name })"
              tabindex="-1"
              @click="onClose($event, tab.id)"
            >
              <icon-lucide-x :class="baseStyles.closeIcon()" />
            </button>
          </Tip>
        </TabsTrigger>
      </template>
    </TabsList>
    <!--
      Not on home: the workspace already offers New Design, New Slides and
      Import as its own buttons, so the strip would only be a second door to
      the same three things.
    -->
    <DropdownMenuRoot v-if="!showingHome">
      <DropdownMenuTrigger as-child>
        <button
          data-test-id="tabbar-new"
          :class="baseStyles.newAction()"
          :aria-label="dialogs.createDocument"
          :title="dialogs.createDocument"
        >
          <icon-lucide-plus :class="baseStyles.newIcon()" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuPortal>
        <DropdownMenuContent :class="menuCls.content" align="start" :side-offset="4">
          <DropdownMenuItem
            :class="itemCls"
            data-test-id="tabbar-create-design"
            @select="void create('fig')"
          >
            <img :src="storageDocumentIconUrls.fig" alt="" class="size-4 rounded-[2px]" />
            {{ dialogs.createDesign }}
          </DropdownMenuItem>
          <DropdownMenuItem
            :class="itemCls"
            data-test-id="tabbar-create-slides"
            @select="void create('deck')"
          >
            <img :src="storageDocumentIconUrls.deck" alt="" class="size-4 rounded-[2px]" />
            {{ dialogs.createSlides }}
          </DropdownMenuItem>
          <DropdownMenuSeparator :class="menuCls.separator" />
          <DropdownMenuItem :class="itemCls" data-test-id="tabbar-import" @select="void goImport()">
            <icon-lucide-import class="size-4" />
            {{ dialogs.createImport }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenuPortal>
    </DropdownMenuRoot>
  </TabsRoot>
</template>
