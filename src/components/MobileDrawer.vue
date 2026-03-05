<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'

import ChatPanel from './ChatPanel.vue'
import CodePanel from './CodePanel.vue'
import DesignPanel from './DesignPanel.vue'
import LayerTree from './LayerTree.vue'
import PagesPanel from './PagesPanel.vue'
import { HALF_FRAC, HUD_TOP, RIBBON_H } from '@/constants'
import { useEditorStore } from '@/stores/editor'

type Snap = 'closed' | 'half' | 'full'

const store = useEditorStore()

const snap = computed({
  get: (): Snap => store.state.mobileDrawerSnap,
  set: (v: Snap) => {
    store.state.mobileDrawerSnap = v
  }
})

const visible = ref(false)
const animating = ref(false)
const renderSnap = ref<Snap>('closed')

watch(snap, async (next, prev) => {
  if (next !== 'closed' && prev === 'closed') {
    visible.value = true
    renderSnap.value = 'closed'
    await nextTick()
    requestAnimationFrame(() => {
      animating.value = true
      renderSnap.value = next
    })
  } else if (next === 'closed') {
    animating.value = true
    renderSnap.value = 'closed'
  } else {
    animating.value = true
    renderSnap.value = next
  }
})

function onTransitionEnd() {
  animating.value = false
  if (renderSnap.value === 'closed') {
    visible.value = false
  }
}

function snapHeight(s: Snap): number {
  const vh = window.innerHeight
  switch (s) {
    case 'full':
      return vh - RIBBON_H - HUD_TOP
    case 'half':
      return Math.round(vh * HALF_FRAC)
    default:
      return Math.round(vh * HALF_FRAC)
  }
}

let dragStartY = 0
let dragStartSnap: Snap = 'half'
let dragging = false
const dragOffset = ref(0)

function onDragStart(e: TouchEvent) {
  dragStartY = e.touches[0].clientY
  dragStartSnap = snap.value
  dragging = true
  dragOffset.value = 0
}

function onDragMove(e: TouchEvent) {
  if (!dragging) return
  dragOffset.value = e.touches[0].clientY - dragStartY
}

function onDragEnd() {
  if (!dragging) return
  dragging = false
  const dy = dragOffset.value
  dragOffset.value = 0

  const THRESHOLD = 50

  if (dy < -THRESHOLD) {
    snap.value = dragStartSnap === 'closed' ? 'half' : 'full'
  } else if (dy > THRESHOLD) {
    snap.value = dragStartSnap === 'full' ? 'half' : 'closed'
    if (snap.value === 'closed') {
      store.state.activeRibbonTab = null
    }
  }
}

const drawerTransform = computed(() => {
  if (dragging && dragOffset.value !== 0) {
    const clamped = Math.max(0, dragOffset.value)
    return `translateY(${clamped}px)`
  }
  return renderSnap.value === 'closed' ? 'translateY(100%)' : 'translateY(0)'
})

const drawerHeight = computed(() => `${snapHeight(renderSnap.value)}px`)
</script>

<template>
  <div
    v-show="visible"
    data-test-id="mobile-drawer"
    class="fixed inset-x-0 z-30 flex flex-col rounded-t-xl border-t border-border bg-panel"
    :class="dragging ? '' : 'transition-[transform,height] duration-300 ease-out'"
    :style="{
      bottom: `calc(${RIBBON_H}px + env(safe-area-inset-bottom))`,
      height: drawerHeight,
      transform: drawerTransform
    }"
    @transitionend="onTransitionEnd"
    @touchstart.passive="onDragStart"
    @touchmove.passive="onDragMove"
    @touchend.passive="onDragEnd"
  >
    <div
      data-test-id="mobile-drawer-handle"
      class="flex shrink-0 items-center justify-center py-2 select-none"
      aria-hidden="true"
    >
      <div class="h-1 w-8 rounded-full bg-muted/40" />
    </div>

    <div
      data-test-id="mobile-drawer-pages"
      class="shrink-0 overflow-x-auto border-b border-border px-3 scrollbar-none"
    >
      <PagesPanel />
    </div>

    <div
      data-test-id="mobile-drawer-content"
      class="min-h-0 flex-1 overflow-y-auto"
      @touchstart.stop
      @touchmove.stop
    >
      <div
        v-show="store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'layers'"
        data-test-id="mobile-drawer-layers"
        class="flex h-full flex-col"
      >
        <header class="shrink-0 px-3 py-2 text-[11px] uppercase tracking-wider text-muted">
          Layers
        </header>
        <LayerTree />
      </div>

      <div
        v-show="store.state.activeRibbonTab === 'panels' && store.state.panelMode === 'design'"
        data-test-id="mobile-drawer-design"
        class="flex h-full flex-col"
      >
        <DesignPanel />
      </div>

      <div
        v-show="store.state.activeRibbonTab === 'code'"
        data-test-id="mobile-drawer-code"
        class="flex h-full flex-col"
      >
        <CodePanel />
      </div>

      <div
        v-show="store.state.activeRibbonTab === 'ai'"
        data-test-id="mobile-drawer-ai"
        class="flex h-full flex-col"
      >
        <ChatPanel />
      </div>
    </div>
  </div>
</template>
