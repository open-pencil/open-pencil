<script setup lang="ts">
import { useDevicePixelRatio } from '@vueuse/core'
import { computed, nextTick, ref, watch } from 'vue'

import { SECTION_TITLE_FONT_FAMILY } from '@open-pencil/core/constants'

/** The label's text box in screen pixels, as the canvas draws it. */
export interface InlineLabelMetrics {
  fontSize: number
  lineHeight: number
  paddingX: number
}

const {
  modelValue,
  label,
  metrics,
  variant = 'section'
} = defineProps<{
  modelValue: string
  label: string
  /**
   * The canvas draws labels in screen pixels whatever the interface size, so the editor takes the
   * canvas's pixel sizes rather than the interface's rem ones.
   */
  metrics: InlineLabelMetrics
  /** The typography of the label it edits: a section title's pill or a frame's plain name. */
  variant?: 'section' | 'name'
}>()

const WEIGHT = { section: 'font-semibold', name: 'font-normal' }
const { pixelRatio } = useDevicePixelRatio()
// Section titles use the canvas's own title face; names use Inter like the rest of the page.
// The canvas centers a title by its measured paragraph, the page by the font's line box, which
// leaves the page's text one device pixel higher.
const font = computed(() => {
  const box = {
    fontSize: `${metrics.fontSize}px`,
    lineHeight: `${metrics.lineHeight}px`,
    paddingInline: `${metrics.paddingX}px`
  }
  if (variant !== 'section') return box
  return {
    ...box,
    fontFamily: `'${SECTION_TITLE_FONT_FAMILY}', Inter, sans-serif`,
    transform: `translateY(${1 / pixelRatio.value}px)`
  }
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  commit: []
  cancel: []
}>()

const input = ref<HTMLInputElement | null>(null)

function updateValue(event: Event) {
  const target = event.target
  if (target instanceof HTMLInputElement) emit('update:modelValue', target.value)
}

watch(
  () => input.value,
  (element) => {
    if (!element) return
    void nextTick(() => {
      element.focus()
      element.select()
    })
  },
  { immediate: true }
)
</script>

<template>
  <div class="grid h-full">
    <span
      aria-hidden="true"
      class="invisible col-start-1 row-start-1 h-full whitespace-pre"
      :class="WEIGHT[variant]"
      :style="font"
      >{{ modelValue || ' ' }}</span
    >
    <input
      ref="input"
      :value="modelValue"
      :aria-label="label"
      class="col-start-1 row-start-1 h-full w-0 min-w-full bg-transparent outline-none"
      :class="WEIGHT[variant]"
      :style="font"
      @input="updateValue"
      @keydown.enter.prevent="emit('commit')"
      @keydown.escape.prevent="emit('cancel')"
      @blur="emit('commit')"
    />
  </div>
</template>
