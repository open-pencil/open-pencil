<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import { storageDocumentIconUrls } from '@/app/storage/document-icons'
import Tip from '@/components/ui/Tip.vue'
import tabBarTheme from '@/theme/tab-bar'
import { useTabsStore, createTab } from '@/app/tabs'
import { useI18n } from '@open-pencil/vue'

const { dialogs } = useI18n()

const router = useRouter()
const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()

// Fixed destination rather than history: desktop has no browser history, and on
// web the previous entry is often another document, not the workspace.
async function backToWorkspace(): Promise<void> {
  await router.push('/')
}
const tabBarStyles = tv(tabBarTheme)
const baseStyles = tabBarStyles()

const modelValue = computed({
  get: () => activeTabId.value,
  set: (id: string) => switchTab(id)
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
        :class="baseStyles.home()"
        :aria-label="dialogs.backToStorageWorkspace"
        @click="backToWorkspace"
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
        :class="tabBarStyles({ active: tab.isActive }).trigger()"
        :data-active="tab.isActive || undefined"
        @mousedown="onMiddleClick($event, tab.id)"
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
