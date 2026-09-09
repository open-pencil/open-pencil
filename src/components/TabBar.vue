<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { useTabsStore, createHomeTab } from '@/app/tabs'
import PreparationIndicator from '@/components/preparation/tab/Indicator.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import tabBarTheme from '@/theme/tab-bar'

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
      <div
        v-for="tab in tabs"
        :key="tab.id"
        data-slot="tab-item"
        :class="tabBarStyles({ active: tab.isActive }).item()"
        @mousedown="onMiddleClick($event, tab.id, tab.isHome)"
      >
        <TabsTrigger
          :value="tab.id"
          data-test-id="tabbar-tab"
          :class="tabBarStyles({ active: tab.isActive }).trigger()"
          :data-active="tab.isActive || undefined"
        >
          <icon-lucide-house v-if="tab.isHome" :class="baseStyles.icon()" />
          <PreparationIndicator v-else-if="tab.isPreparing" :progress="tab.preparationProgress" />
          <icon-lucide-file v-else :class="baseStyles.icon()" />
          <span :class="baseStyles.label()">{{ tab.isHome ? files.newTab : tab.name }}</span>
        </TabsTrigger>
        <Tip
          v-if="!tab.isHome || tabs.length > 1"
          :label="files.closeTab({ name: tab.isHome ? files.newTab : tab.name })"
        >
          <button
            type="button"
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
      </div>
    </TabsList>
    <IconButton :label="files.newTab" size="md" data-test-id="tabbar-new" @click="createNewTab">
      <icon-lucide-plus :class="baseStyles.newIcon()" />
    </IconButton>
  </TabsRoot>
</template>
