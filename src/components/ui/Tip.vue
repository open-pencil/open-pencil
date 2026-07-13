<script setup lang="ts">
import { useEventListener, useTimeoutFn } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import { useTooltipUI } from '@/components/ui/tooltip'

const TOOLTIP_OPEN_DELAY_MS = 400
const TOOLTIP_SIDE_OFFSET = 4
const TOOLTIP_VIEWPORT_PADDING = 8

type TooltipSide = 'top' | 'bottom' | 'left' | 'right'

const cls = useTooltipUI({ content: 'animate-in zoom-in-95 fade-in' })

const {
  side = 'top',
  disabled = false,
  label
} = defineProps<{
  label?: string
  side?: TooltipSide
  disabled?: boolean
}>()

const triggerRef = ref<HTMLElement>()
const contentRef = ref<HTMLElement>()
const open = ref(false)
const position = ref({ x: 0, y: 0 })

const canOpen = computed(() => Boolean(label) && !disabled)
const contentStyle = computed(() => ({
  left: `${position.value.x}px`,
  top: `${position.value.y}px`
}))

const { start: startOpenTimer, stop: stopOpenTimer } = useTimeoutFn(
  () => {
    open.value = true
    void nextTick(refreshPosition)
  },
  TOOLTIP_OPEN_DELAY_MS,
  { immediate: false }
)

function anchorElement() {
  const root = triggerRef.value
  const child = root?.firstElementChild
  return child instanceof HTMLElement ? child : root
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function refreshPosition() {
  if (!open.value) return

  const anchor = anchorElement()
  const content = contentRef.value
  if (!anchor || !content) return

  const anchorRect = anchor.getBoundingClientRect()
  const contentRect = content.getBoundingClientRect()
  const centerX = anchorRect.left + anchorRect.width / 2
  const centerY = anchorRect.top + anchorRect.height / 2

  let x = centerX - contentRect.width / 2
  let y = anchorRect.top - contentRect.height - TOOLTIP_SIDE_OFFSET

  if (side === 'bottom') y = anchorRect.bottom + TOOLTIP_SIDE_OFFSET
  if (side === 'left') {
    x = anchorRect.left - contentRect.width - TOOLTIP_SIDE_OFFSET
    y = centerY - contentRect.height / 2
  }
  if (side === 'right') {
    x = anchorRect.right + TOOLTIP_SIDE_OFFSET
    y = centerY - contentRect.height / 2
  }

  position.value = {
    x: clamp(
      x,
      TOOLTIP_VIEWPORT_PADDING,
      window.innerWidth - contentRect.width - TOOLTIP_VIEWPORT_PADDING
    ),
    y: clamp(
      y,
      TOOLTIP_VIEWPORT_PADDING,
      window.innerHeight - contentRect.height - TOOLTIP_VIEWPORT_PADDING
    )
  }
}

function show() {
  if (!canOpen.value) return
  stopOpenTimer()
  startOpenTimer()
}

function hide() {
  stopOpenTimer()
  open.value = false
}

function containsRelatedTarget(event: PointerEvent | FocusEvent) {
  const relatedTarget = event.relatedTarget
  return relatedTarget instanceof Node && triggerRef.value?.contains(relatedTarget)
}

function onPointerOver(event: PointerEvent) {
  if (containsRelatedTarget(event)) return
  show()
}

function onPointerOut(event: PointerEvent) {
  if (containsRelatedTarget(event)) return
  hide()
}

function onFocusIn(event: FocusEvent) {
  if (containsRelatedTarget(event)) return
  show()
}

function onFocusOut(event: FocusEvent) {
  if (containsRelatedTarget(event)) return
  hide()
}

function onPointerDown() {
  hide()
}

useEventListener(window, 'resize', refreshPosition)
useEventListener(window, 'scroll', refreshPosition, { capture: true, passive: true })
useEventListener(document, 'pointerdown', hide, { capture: true })
useEventListener(document, 'click', hide, { capture: true })

watch(canOpen, (value) => {
  if (!value) hide()
})
</script>

<template>
  <span
    ref="triggerRef"
    class="contents"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @pointerover="onPointerOver"
    @pointerout="onPointerOut"
    @pointerdown="onPointerDown"
    @click="hide"
  >
    <slot />
  </span>
  <Teleport to="body">
    <div
      v-if="open && label"
      ref="contentRef"
      role="tooltip"
      :class="cls.content"
      class="pointer-events-none fixed"
      :style="contentStyle"
    >
      {{ label }}
    </div>
  </Teleport>
</template>
