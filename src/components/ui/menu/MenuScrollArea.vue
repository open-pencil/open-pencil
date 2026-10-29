<script setup lang="ts">
import { useRafFn, useResizeObserver, useScroll } from '@vueuse/core'
import { ref, useTemplateRef, watch } from 'vue'

import { useMenuUI } from '@/components/ui/menu/menu'

/** Pixels per millisecond while the pointer rests on a chevron, about a row every 50 ms. */
const SCROLL_SPEED = 0.5

type Edge = 'top' | 'bottom'

/**
 * The body of a menu taller than the window. Like Figma's and native macOS menus, it shows no
 * scrollbar: a chevron strip covers each end that has more, and resting the pointer on one
 * scrolls the list; the wheel and the arrow keys scroll it too.
 */
const cls = useMenuUI()
const viewport = useTemplateRef<HTMLElement>('viewport')
const { arrivedState, measure } = useScroll(viewport, { offset: { top: 1, bottom: 1 } })
useResizeObserver(viewport, () => measure())

const scrolling = ref<Edge | null>(null)
const { pause, resume } = useRafFn(
  ({ delta }) => {
    const step = SCROLL_SPEED * delta
    viewport.value?.scrollBy({ top: scrolling.value === 'top' ? -step : step })
  },
  { immediate: false }
)

function startScrolling(edge: Edge) {
  scrolling.value = edge
  resume()
}

function stopScrolling() {
  scrolling.value = null
  pause()
}

// The strip goes away once its end is reached, so its pointerleave never comes.
watch(
  () => scrolling.value !== null && arrivedState[scrolling.value],
  (arrived) => {
    if (arrived) stopScrolling()
  }
)
</script>

<template>
  <div :class="cls.scrollRoot">
    <div ref="viewport" :class="cls.scrollViewport"><slot /></div>
    <div
      v-if="!arrivedState.top"
      data-edge="top"
      aria-hidden="true"
      :class="cls.scrollButton"
      @pointerenter="startScrolling('top')"
      @pointerleave="stopScrolling"
    >
      <icon-lucide-chevron-up class="size-3" />
    </div>
    <div
      v-if="!arrivedState.bottom"
      data-edge="bottom"
      aria-hidden="true"
      :class="cls.scrollButton"
      @pointerenter="startScrolling('bottom')"
      @pointerleave="stopScrolling"
    >
      <icon-lucide-chevron-down class="size-3" />
    </div>
  </div>
</template>
