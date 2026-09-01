<script setup lang="ts">
import { computed } from 'vue'
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'

import PreparationIndicator from '@/components/preparation/tab/Indicator.vue'
import Tip from '@/components/ui/Tip.vue'
import tabBarTheme from '@/theme/tab-bar'
import { useTabsStore, createHomeTab } from '@/app/tabs'
import { useI18n } from '@open-pencil/vue'

const { files } = useI18n()

const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()
const tabBarStyles = tv(tabBarTheme)
const baseStyles = tabBarStyles()

const modelValue = computed({
  get: () => activeTabId.value,
  set: (id: string) => switchTab(id)
})

function createNewTab(event: MouseEvent): void {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.blur()
  createHomeTab()
}

function onMiddleClick(e: MouseEvent, tabId: string, isHome: boolean) {
  if (e.button === 1 && (!isHome || tabs.value.length > 1)) {
    e.preventDefault()
    void closeTab(tabId)
  }
}

function onClose(e: MouseEvent, tabId: string) {
  e.stopPropagation()
  void closeTab(tabId)
}
</script>

<template>
  <TabsRoot
    v-if="tabs.length > 0"
    v-model="modelValue"
    activation-mode="automatic"
    :class="baseStyles.root()"
  >
    <TabsList :class="baseStyles.list()">
      <TabsTrigger
        v-for="tab in tabs"
        :key="tab.id"
        :value="tab.id"
        data-test-id="tabbar-tab"
        :class="tabBarStyles({ active: tab.isActive }).trigger()"
        :data-active="tab.isActive || undefined"
        @mousedown="onMiddleClick($event, tab.id, tab.isHome)"
      >
        <icon-lucide-house v-if="tab.isHome" :class="baseStyles.icon()" />
        <PreparationIndicator v-else-if="tab.isPreparing" :progress="tab.preparationProgress" />
        <icon-lucide-file v-else :class="baseStyles.icon()" />
        <span :class="baseStyles.label()">{{ tab.isHome ? files.newTab : tab.name }}</span>
        <Tip
          v-if="!tab.isHome || tabs.length > 1"
          :label="files.closeTab({ name: tab.isHome ? files.newTab : tab.name })"
        >
          <button
            data-test-id="tabbar-close"
            :class="tabBarStyles({ active: tab.isActive }).close()"
            :data-active="tab.isActive || undefined"
            :aria-label="files.closeTab({ name: tab.isHome ? files.newTab : tab.name })"
            tabindex="-1"
            @click="onClose($event, tab.id)"
          >
            <icon-lucide-x :class="baseStyles.closeIcon()" />
          </button>
        </Tip>
      </TabsTrigger>
    </TabsList>
    <Tip :label="files.newTab">
      <button
        data-test-id="tabbar-new"
        :class="baseStyles.newAction()"
        :aria-label="files.newTab"
        @click="createNewTab"
      >
        <icon-lucide-plus :class="baseStyles.newIcon()" />
      </button>
    </Tip>
  </TabsRoot>
</template>
