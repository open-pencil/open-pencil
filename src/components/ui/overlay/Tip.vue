<script setup lang="ts">
/**
 * A tooltip around any control. It is not Reka's Tooltip: Reka shares one unscoped popper context,
 * so a popover or menu trigger wrapped in a `TooltipRoot` anchors its own content to the tooltip.
 * Positioning comes from floating-ui, which Reka uses as well.
 */
import { autoUpdate, flip, offset, shift, useFloating } from '@floating-ui/vue'
import { defaultDocument, unrefElement, useEventListener, useTimeoutFn } from '@vueuse/core'
import { Primitive } from 'reka-ui'
import type { ComponentPublicInstance } from 'vue'
import { computed, onDeactivated, ref, shallowRef, watch } from 'vue'

import {
  TOOLTIP_SKIP_DELAY_MS,
  useTooltipUI,
  useTooltipWarmth
} from '@/components/ui/overlay/tooltip'
import { motionStyles } from '@/theme/motion/styles'

const TOOLTIP_OPEN_DELAY_MS = 400
const TOOLTIP_SIDE_OFFSET = 4
const TOOLTIP_VIEWPORT_PADDING = 8
const TOOLTIP_CLAIM_EVENT = 'open-pencil:tooltip-claim'

const cls = useTooltipUI({ content: motionStyles.popup })
const lastClosedAt = useTooltipWarmth()

const {
  asChild = false,
  side = 'top',
  disabled = false,
  label
} = defineProps<{
  asChild?: boolean
  label?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  disabled?: boolean
}>()

const trigger = shallowRef<HTMLElement>()
function setTrigger(value: Element | ComponentPublicInstance | null) {
  const element = value instanceof Element ? value : unrefElement(value)
  trigger.value = element instanceof HTMLElement ? element : undefined
}
/** A wrapper is `display: contents`, so the tooltip anchors to the control inside it. */
const anchor = computed(() => {
  const child = asChild ? trigger.value : trigger.value?.firstElementChild
  return child instanceof HTMLElement ? child : trigger.value
})
const content = shallowRef<HTMLElement>()
const open = ref(false)
const { floatingStyles } = useFloating(anchor, content, {
  open,
  placement: () => side,
  strategy: 'fixed',
  // Position with left and top: the grow-in animation owns transform.
  transform: false,
  middleware: [
    offset(TOOLTIP_SIDE_OFFSET),
    flip({ padding: TOOLTIP_VIEWPORT_PADDING }),
    shift({ padding: TOOLTIP_VIEWPORT_PADDING })
  ],
  whileElementsMounted: autoUpdate
})

const {
  isPending,
  start: startOpenTimer,
  stop: stopOpenTimer
} = useTimeoutFn(
  () => {
    open.value = true
  },
  TOOLTIP_OPEN_DELAY_MS,
  { immediate: false }
)

function show() {
  if (!label || disabled) return
  document.dispatchEvent(new CustomEvent(TOOLTIP_CLAIM_EVENT, { detail: trigger.value }))
  stopOpenTimer()
  if (performance.now() - lastClosedAt.value < TOOLTIP_SKIP_DELAY_MS) open.value = true
  else startOpenTimer()
}

function hide() {
  stopOpenTimer()
  open.value = false
}

/** Closes as the pointer or focus moves on, so a neighbouring tooltip opens without the delay. */
function leave() {
  if (open.value) lastClosedAt.value = performance.now()
  hide()
}

/** A tooltip nested inside this one, such as a field's variable button, speaks for itself. */
function isNested(event: Event) {
  return (
    event.target instanceof Element &&
    event.target.closest('[data-tooltip-trigger]') !== trigger.value
  )
}

function staysInside(event: PointerEvent | FocusEvent) {
  return (
    event.relatedTarget instanceof Node && Boolean(trigger.value?.contains(event.relatedTarget))
  )
}

function onPointerOver(event: PointerEvent) {
  if (isNested(event)) hide()
  else if (!staysInside(event)) show()
}

function onPointerOut(event: PointerEvent) {
  if (!staysInside(event)) leave()
}

function onFocusIn(event: FocusEvent) {
  if (isNested(event)) hide()
  // Popovers focus their first control on open; only keyboard focus asks for a tooltip.
  else if (
    !staysInside(event) &&
    event.target instanceof Element &&
    event.target.matches(':focus-visible')
  )
    show()
}

function onFocusOut(event: FocusEvent) {
  if (!staysInside(event)) leave()
}

const claimTarget = computed(() => (open.value || isPending.value ? defaultDocument : undefined))
useEventListener(claimTarget, TOOLTIP_CLAIM_EVENT, (event: Event) => {
  if (event instanceof CustomEvent && event.detail !== trigger.value) leave()
})
onDeactivated(hide)
watch(
  () => !label || disabled,
  (off) => {
    if (off) hide()
  }
)
</script>

<template>
  <Primitive
    :ref="setTrigger"
    as="span"
    :as-child="asChild"
    data-tooltip-trigger
    :data-as-child="asChild"
    class="data-[as-child=false]:contents"
    @pointerover="onPointerOver"
    @pointerout="onPointerOut"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @pointerdown="hide"
    @click="hide"
  >
    <slot />
  </Primitive>
  <Teleport v-if="open && label" to="body">
    <div
      ref="content"
      role="tooltip"
      :class="cls.content"
      class="pointer-events-none"
      :style="floatingStyles"
    >
      {{ label }}
    </div>
  </Teleport>
</template>
