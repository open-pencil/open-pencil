<script setup lang="ts">
import { useElementSize, useWindowSize } from '@vueuse/core'
import { TabsContent, TabsList, TabsRoot, TabsTrigger } from 'reka-ui'
import { motion } from 'motion-v'
import type { PanInfo } from 'motion-v'
import { computed, ref } from 'vue'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import LayerTree from './LayerTree.vue'
import PagesPanel from './PagesPanel.vue'
import {
  DRAWER_SPRING_DAMPING,
  DRAWER_SPRING_STIFFNESS,
  HALF_FRAC,
  HUD_TOP,
  SWIPE_THRESHOLD,
  SWIPE_VELOCITY_THRESHOLD
} from '@/constants'
import { useEditorStore } from '@/stores/editor'

type Snap = 'closed' | 'half' | 'full'
type DrawerTab = 'layers' | 'design' | 'code' | 'ai'

const store = useEditorStore()

const headerRef = ref<HTMLElement | null>(null)

const { height: headerH } = useElementSize(headerRef, { width: 0, height: 56 })
const { height: windowH } = useWindowSize()

const snap = computed({
  get: (): Snap => store.state.mobileDrawerSnap,
  set: (v: Snap) => {
    store.state.mobileDrawerSnap = v
  }
})

function getDrawerTab(): DrawerTab {
  if (store.state.activeRibbonTab === 'code') return 'code'
  if (store.state.activeRibbonTab === 'ai') return 'ai'
  return store.state.panelMode === 'design' ? 'design' : 'layers'
}

function setDrawerTab(tab: DrawerTab) {
  if (tab === 'code' || tab === 'ai') {
    store.state.activeRibbonTab = tab
    return
  }
  store.state.activeRibbonTab = 'panels'
  store.state.panelMode = tab
}

const isOpen = computed(() => snap.value !== 'closed')

function toggleTab(tab: DrawerTab) {
  if (getDrawerTab() === tab && isOpen.value) {
    snap.value = 'closed'
    targetHeight.value = snapHeight('closed')
    return
  }

  setDrawerTab(tab)
  if (!isOpen.value) {
    snap.value = 'half'
    targetHeight.value = snapHeight('half')
  }
}

function snapHeight(s: Snap): number {
  switch (s) {
    case 'full':
      return windowH.value - HUD_TOP
    case 'half':
      return Math.round(windowH.value * HALF_FRAC)
    default:
      return headerH.value
  }
}

const targetHeight = ref(snapHeight(snap.value))

function onPan(_e: PointerEvent, info: PanInfo) {
  const maxHeight = snapHeight('full')
  const raw = snapHeight(snap.value) - info.offset.y
  targetHeight.value = Math.max(headerH.value, Math.min(maxHeight, raw))
}

function onPanEnd(_e: PointerEvent, info: PanInfo) {
  const isSwipeUp = info.offset.y < -SWIPE_THRESHOLD || info.velocity.y < -SWIPE_VELOCITY_THRESHOLD
  const isSwipeDown = info.offset.y > SWIPE_THRESHOLD || info.velocity.y > SWIPE_VELOCITY_THRESHOLD

  if (isSwipeUp) {
    if (snap.value === 'closed') snap.value = 'half'
    else snap.value = 'full'
  } else if (isSwipeDown) {
    if (snap.value === 'full') snap.value = 'half'
    else snap.value = 'closed'
  }

  targetHeight.value = snapHeight(snap.value)
}

const drawerTransition = {
  type: 'spring' as const,
  stiffness: DRAWER_SPRING_STIFFNESS,
  damping: DRAWER_SPRING_DAMPING
}
</script>

<template>
  <motion.div
    data-test-id="mobile-drawer"
    class="fixed inset-x-0 bottom-0 z-30 flex touch-none flex-col rounded-t-3xl bg-panel shadow-[0_-2px_10px_rgba(0,0,0,0.3)] pb-[env(safe-area-inset-bottom)]"
    :animate="{ height: `${targetHeight}px` }"
    :transition="drawerTransition"
    @pan="onPan"
    @panEnd="onPanEnd"
  >
    <TabsRoot :model-value="getDrawerTab()" class="flex min-h-0 flex-1 flex-col">
      <nav ref="headerRef" aria-label="Mobile panel navigation" class="flex shrink-0 flex-col">
        <div class="flex w-full justify-center pt-2">
          <div class="h-1 w-8 rounded-full bg-muted/40" />
        </div>
        <TabsList class="flex w-full items-center px-2 py-2">
          <TabsTrigger
            data-test-id="mobile-ribbon-layers"
            value="layers"
            class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none data-[state=active]:text-accent"
            @click="toggleTab('layers')"
          >
            <icon-lucide-layers class="size-4" />
          </TabsTrigger>

          <TabsTrigger
            data-test-id="mobile-ribbon-design"
            value="design"
            class="flex h-full cursor-pointer items-center justify-center gap-1.5 px-4 text-xs outline-none transition-colors select-none data-[state=active]:text-accent"
            @click="toggleTab('design')"
          >
            <icon-lucide-sliders-horizontal class="size-4" />
          </TabsTrigger>

          <div class="flex-1" />

          <TabsTrigger
            data-test-id="mobile-ribbon-code"
            value="code"
            class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none data-[state=active]:text-accent"
            @click="toggleTab('code')"
          >
            <icon-lucide-code class="size-4" />
          </TabsTrigger>

          <TabsTrigger
            data-test-id="mobile-ribbon-ai"
            value="ai"
            class="flex h-full cursor-pointer items-center justify-center px-3 outline-none transition-colors select-none data-[state=active]:text-accent"
            @click="toggleTab('ai')"
          >
            <icon-lucide-sparkles class="size-4" />
          </TabsTrigger>
        </TabsList>
      </nav>

      <div data-test-id="mobile-drawer-content" class="min-h-0 flex-1 overflow-y-auto">
        <TabsContent value="layers" class="mt-0 h-full data-[state=inactive]:hidden">
          <div data-test-id="mobile-drawer-layers" class="flex h-full flex-col">
            <PagesPanel />
            <div class="border-t border-border" />
            <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
              Layers
            </header>
            <LayerTree class="min-h-0 flex-1" />
          </div>
        </TabsContent>

        <TabsContent value="design" class="mt-0 h-full data-[state=inactive]:hidden">
          <div data-test-id="mobile-drawer-design" class="flex h-full flex-col">
            <DesignPanel />
          </div>
        </TabsContent>

        <TabsContent value="code" class="mt-0 h-full data-[state=inactive]:hidden">
          <div data-test-id="mobile-drawer-code" class="flex h-full flex-col">
            <CodePanel />
          </div>
        </TabsContent>

        <TabsContent value="ai" class="mt-0 h-full data-[state=inactive]:hidden">
          <div data-test-id="mobile-drawer-ai" class="flex h-full flex-col">
            <ChatPanel />
          </div>
        </TabsContent>
      </div>
    </TabsRoot>
  </motion.div>
</template>
