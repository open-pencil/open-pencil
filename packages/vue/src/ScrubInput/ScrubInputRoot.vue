<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useEventListener } from '@vueuse/core'

import { provideScrubInput } from './context'

const props = withDefaults(
  defineProps<{
    modelValue: number | symbol
    min?: number
    max?: number
    step?: number
    sensitivity?: number
    placeholder?: string
  }>(),
  {
    min: -Infinity,
    max: Infinity,
    step: 1,
    sensitivity: 1,
    placeholder: 'Mixed'
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
}>()

const editing = ref(false)
const scrubbing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const isMixed = computed(() => typeof props.modelValue === 'symbol')
const numericValue = computed(() => (isMixed.value ? 0 : (props.modelValue as number)))
const displayValue = computed(() => (isMixed.value ? '' : String(Math.round(numericValue.value))))

let stopMove: (() => void) | undefined
let stopUp: (() => void) | undefined

function startScrub(e: PointerEvent) {
  e.preventDefault()
  const startX = e.clientX
  let lastX = startX
  let accumulated = numericValue.value
  const valueBeforeScrub = numericValue.value
  let hasMoved = false

  stopMove = useEventListener(document, 'pointermove', (ev: PointerEvent) => {
    const dx = ev.clientX - lastX
    lastX = ev.clientX
    if (!hasMoved && Math.abs(ev.clientX - startX) > 2) {
      hasMoved = true
      scrubbing.value = true
      document.body.style.cursor = 'ew-resize'
    }
    if (hasMoved) {
      accumulated += dx * props.step * props.sensitivity
      const clamped = Math.round(Math.min(props.max, Math.max(props.min, accumulated)))
      if (clamped !== props.modelValue) emit('update:modelValue', clamped)
    }
  })

  stopUp = useEventListener(document, 'pointerup', () => {
    scrubbing.value = false
    document.body.style.cursor = ''
    stopMove?.()
    stopUp?.()
    if (hasMoved) {
      if (typeof props.modelValue === 'number' && props.modelValue !== valueBeforeScrub) {
        emit('commit', props.modelValue, valueBeforeScrub)
      }
    } else {
      startEdit()
    }
  })
}

function startEdit() {
  editing.value = true
  requestAnimationFrame(() => inputRef.value?.select())
}

function commitEdit(e: Event) {
  const val = +(e.target as HTMLInputElement).value
  const previous = numericValue.value
  if (!Number.isNaN(val)) {
    const clamped = Math.min(props.max, Math.max(props.min, val))
    emit('update:modelValue', clamped)
    if (clamped !== previous) emit('commit', clamped, previous)
  }
  editing.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Enter') commitEdit(e)
  else if (e.code === 'Escape') editing.value = false
}

const ctx = {
  modelValue: toRef(props, 'modelValue'),
  displayValue,
  isMixed,
  editing,
  scrubbing,
  inputRef,
  startScrub,
  startEdit,
  commitEdit,
  onKeydown
}

provideScrubInput(ctx)
</script>

<template>
  <slot
    :model-value="props.modelValue"
    :display-value="displayValue"
    :is-mixed="isMixed"
    :editing="editing"
    :scrubbing="scrubbing"
    :start-scrub="startScrub"
    :start-edit="startEdit"
    :commit-edit="commitEdit"
    :keydown="onKeydown"
    :placeholder="props.placeholder"
  />
</template>
