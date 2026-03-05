<script setup lang="ts">
import { computed } from 'vue'

import { SWIPE_MAX_DURATION, SWIPE_THRESHOLD } from '@/constants'
import { useEditorStore } from '@/stores/editor'

const store = useEditorStore()

const emit = defineEmits<{
  'tab-change': [tab: 'panels' | 'code' | 'ai']
}>()

const isLayersActive = computed(
  () => store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'layers'
)
const isDesignActive = computed(
  () => store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'design'
)

function selectTab(tab: 'panels' | 'code' | 'ai') {
  if (store.state.activeRibbonTab === tab && store.state.mobileDrawerSnap !== 'closed') {
    store.state.activeRibbonTab = null
    store.state.mobileDrawerSnap = 'closed'
    return
  }
  store.state.activeRibbonTab = tab
  emit('tab-change', tab)
}

function selectPanel(mode: 'layers' | 'design') {
  if (
    store.state.activeRibbonTab === 'panels' &&
    store.state.panelMode === mode &&
    store.state.mobileDrawerSnap !== 'closed'
  ) {
    store.state.activeRibbonTab = null
    store.state.mobileDrawerSnap = 'closed'
    return
  }
  store.state.activeRibbonTab = 'panels'
  store.state.panelMode = mode
  emit('tab-change', 'panels')
}

let touchStartY = 0
let touchStartTime = 0

function onRibbonTouchStart(e: TouchEvent) {
  touchStartY = e.touches[0].clientY
  touchStartTime = Date.now()
}

function onRibbonTouchEnd(e: TouchEvent) {
  const dy = e.changedTouches[0].clientY - touchStartY
  const dt = Date.now() - touchStartTime
  if (dt > SWIPE_MAX_DURATION) return

  if (dy < -SWIPE_THRESHOLD) {
    if (store.state.mobileDrawerSnap === 'closed') {
      if (!store.state.activeRibbonTab) store.state.activeRibbonTab = 'panels'
      store.state.mobileDrawerSnap = 'half'
    } else {
      store.state.mobileDrawerSnap = 'full'
    }
  } else if (dy > SWIPE_THRESHOLD) {
    store.state.mobileDrawerSnap = 'closed'
    store.state.activeRibbonTab = null
  }
}
</script>

<template>
  <nav
    aria-label="Mobile panel navigation"
    data-test-id="mobile-ribbon"
    class="pointer-events-auto fixed inset-x-0 bottom-0 z-40 flex h-11 items-center border-t border-border bg-panel"
    role="tablist"
    style="padding-bottom: env(safe-area-inset-bottom)"
    @touchstart.passive="onRibbonTouchStart"
    @touchend.passive="onRibbonTouchEnd"
  >
    <div
      role="tab"
      data-test-id="mobile-ribbon-layers"
      :aria-selected="isLayersActive"
      tabindex="0"
      class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none"
      :class="isLayersActive ? 'text-accent' : 'text-muted'"
      @click="selectPanel('layers')"
    >
      <icon-lucide-layers class="size-4" />
      <span v-show="isLayersActive">Layers</span>
    </div>

    <div
      role="tab"
      data-test-id="mobile-ribbon-design"
      :aria-selected="isDesignActive"
      tabindex="0"
      class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none"
      :class="isDesignActive ? 'text-accent' : 'text-muted'"
      @click="selectPanel('design')"
    >
      <icon-lucide-sliders-horizontal class="size-4" />
      <span v-show="isDesignActive">Design</span>
    </div>

    <div class="flex-1" />

    <div
      role="tab"
      data-test-id="mobile-ribbon-code"
      :aria-selected="store.state.activeRibbonTab === 'code'"
      tabindex="0"
      class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none"
      :class="store.state.activeRibbonTab === 'code' ? 'text-accent' : 'text-muted'"
      @click="selectTab('code')"
    >
      <icon-lucide-code class="size-4" />
    </div>

    <div
      role="tab"
      data-test-id="mobile-ribbon-ai"
      :aria-selected="store.state.activeRibbonTab === 'ai'"
      tabindex="0"
      class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none"
      :class="store.state.activeRibbonTab === 'ai' ? 'text-accent' : 'text-muted'"
      @click="selectTab('ai')"
    >
      <icon-lucide-sparkles class="size-4" />
    </div>
  </nav>
</template>
