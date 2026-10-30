<script setup lang="ts">
import { TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { tv } from 'tailwind-variants'
import { computed, useTemplateRef, watch } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { animationsEnabled } from '@/app/shell/motion'
import { useTabsStore, createTab } from '@/app/tabs'
import PreparationIndicator from '@/components/preparation/tab/PreparationIndicator.vue'
import { useScrollOverflow } from '@/components/ui/list/useScrollOverflow'
import Tip from '@/components/ui/overlay/Tip.vue'
import tabBarTheme from '@/theme/tab-bar'

const { files } = useI18n()

const { tabs, activeTabId, switchTab, closeTab } = useTabsStore()
const tabBarStyles = tv(tabBarTheme)
const baseStyles = tabBarStyles()

const scroller = useTemplateRef<HTMLElement>('scroller')
const { overflowing, overflowStart, overflowEnd, scrollTowardHidden } = useScrollOverflow(
  scroller,
  {
    smooth: animationsEnabled
  }
)

// Keep the active tab in view when it opens, when another one is chosen, and when the row starts
// or stops overflowing, since the chevron that appears then narrows the visible row. Scrolling
// alone never triggers it.
watch(
  [activeTabId, overflowing],
  () => {
    scroller.value?.querySelector('[data-slot="tab-item"][data-active]')?.scrollIntoView({
      block: 'nearest',
      inline: 'nearest',
      behavior: animationsEnabled.value ? 'smooth' : 'auto'
    })
  },
  { flush: 'post' }
)

const modelValue = computed({
  get: () => activeTabId.value,
  set: (id: string) => switchTab(id)
})

/** A new design in a tab of its own, as Figma's + does; Home stays pinned first. */
function createNewTab(event: MouseEvent): void {
  event.preventDefault()
  if (event.currentTarget instanceof HTMLElement) event.currentTarget.blur()
  createTab()
}

function onMiddleClick(e: MouseEvent, tabId: string, isHome: boolean) {
  if (e.button === 1 && !isHome) {
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
    data-slot="tab-bar"
    activation-mode="automatic"
    :class="baseStyles.root()"
  >
    <div
      ref="scroller"
      :class="baseStyles.scroller()"
      :data-overflow-start="overflowStart || undefined"
      :data-overflow-end="overflowEnd || undefined"
    >
      <TabsList :class="baseStyles.list()">
        <div
          v-for="tab in tabs"
          :key="tab.id"
          data-slot="tab-item"
          :data-active="tab.isActive || undefined"
          :class="tabBarStyles({ active: tab.isActive, home: tab.isHome }).item()"
          @mousedown="onMiddleClick($event, tab.id, tab.isHome)"
        >
          <TabsTrigger
            :value="tab.id"
            data-test-id="tabbar-tab"
            :class="tabBarStyles({ active: tab.isActive, home: tab.isHome }).trigger()"
            :aria-label="tab.isHome ? files.home : undefined"
            :data-active="tab.isActive || undefined"
            :data-dirty="tab.isDirty || undefined"
          >
            <icon-lucide-house v-if="tab.isHome" :class="baseStyles.icon()" />
            <PreparationIndicator v-else-if="tab.isPreparing" :progress="tab.preparationProgress" />
            <icon-lucide-file v-else :class="baseStyles.icon()" />
            <span v-if="!tab.isHome" :class="baseStyles.label()">{{ tab.name }}</span>
            <Tip v-if="tab.isDirty" :label="files.unsavedChanges" side="bottom">
              <span role="img" :aria-label="files.unsavedChanges" :class="baseStyles.dirtyDot()" />
            </Tip>
          </TabsTrigger>
          <Tip v-if="!tab.isHome" :label="files.closeTab({ name: tab.name })" side="bottom">
            <button
              type="button"
              data-test-id="tabbar-close"
              :class="tabBarStyles({ active: tab.isActive }).close()"
              :data-active="tab.isActive || undefined"
              :aria-label="files.closeTab({ name: tab.name })"
              tabindex="-1"
              @click="onClose($event, tab.id)"
            >
              <icon-lucide-x :class="baseStyles.closeIcon()" />
            </button>
          </Tip>
        </div>
      </TabsList>
    </div>
    <!-- Sits beside the hidden tabs; it keeps its width when it switches sides, so the overflow never flips back.
         Pointer affordance only: arrow keys move between tabs and the active tab scrolls into view. -->
    <button
      v-if="overflowStart || overflowEnd"
      type="button"
      tabindex="-1"
      aria-hidden="true"
      data-test-id="tabbar-scroll"
      :class="baseStyles.scroll()"
      :data-start="!overflowEnd || undefined"
      @click="scrollTowardHidden"
    >
      <icon-lucide-chevron-right v-if="overflowEnd" :class="baseStyles.scrollIcon()" />
      <icon-lucide-chevron-left v-else :class="baseStyles.scrollIcon()" />
    </button>
    <Tip :label="files.newDesign" side="bottom">
      <button
        type="button"
        data-test-id="tabbar-new"
        :aria-label="files.newDesign"
        :class="baseStyles.newTab()"
        @click="createNewTab"
      >
        <icon-lucide-plus :class="baseStyles.newIcon()" />
      </button>
    </Tip>
  </TabsRoot>
</template>
