<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import Tip from '@/components/ui/Tip.vue'
import tabBarTheme from '@/theme/tab-bar'
import { useTabsStore, createTab } from '@/app/tabs'
import { useI18n } from '@open-pencil/vue'

const { dialogs } = useI18n()

const router = useRouter()
const route = useRoute()
const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()

/** Home is a view, not an exit: documents stay open while the workspace shows. */
const showingHome = computed(() => route.path === '/')

async function goHome(): Promise<void> {
  await router.push('/')
}

/** Returning to a document from the workspace needs the route as well as the tab. */
async function activate(tabId: string): Promise<void> {
  switchTab(tabId)
  if (showingHome.value) await router.push('/editor')
}
const tabBarStyles = tv(tabBarTheme)
const baseStyles = tabBarStyles()

const modelValue = computed({
  get: () => (showingHome.value ? '' : activeTabId.value),
  set: (id: string) => void activate(id)
})

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
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        data-test-id="tabbar-tab"
        :class="tabBarStyles({ active: tab.isActive && !showingHome }).trigger()"
        :data-active="(tab.isActive && !showingHome) || undefined"
        @mousedown="onMiddleClick($event, tab.id)"
        @click="void activate(tab.id)"
      >
        <img :src="storageDocumentIconUrls[tab.format]" alt="" :class="baseStyles.icon()" />
        <span :class="baseStyles.label()">{{ tab.name }}</span>
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
    </TabsList>
    <Tip :label="dialogs.newTab">
      <button
        data-test-id="tabbar-new"
        :class="baseStyles.newAction()"
        :aria-label="dialogs.newTab"
        @click="createTab()"
      >
        <icon-lucide-plus :class="baseStyles.newIcon()" />
      </button>
    </Tip>
  </TabsRoot>
</template>
