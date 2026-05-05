<script setup lang="ts">
import { ref, computed, toRef, watch } from 'vue'
import { useEventListener } from '@vueuse/core'

import { provideScrubInput } from '#vue/primitives/ScrubInput/context'

const {
  modelValue,
  min = -Infinity,
  max = Infinity,
  step = 1,
  sensitivity = 1,
  placeholder = 'Mixed'
} = defineProps<{
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  sensitivity?: number
  placeholder?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
  'editing-change': [editing: boolean]
}>()

const editing = ref(false)
const scrubbing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)

const isMixed = computed(() => typeof modelValue === 'symbol')
const numericValue = computed(() => (isMixed.value ? 0 : (modelValue as number)))
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
      accumulated += dx * step * sensitivity
      const clamped = Math.round(Math.min(max, Math.max(min, accumulated)))
      if (clamped !== modelValue) emit('update:modelValue', clamped)
    }
  })

  stopUp = useEventListener(document, 'pointerup', () => {
    scrubbing.value = false
    document.body.style.cursor = ''
    stopMove?.()
    stopUp?.()
    if (hasMoved) {
      if (typeof modelValue === 'number' && modelValue !== valueBeforeScrub) {
        emit('commit', modelValue, valueBeforeScrub)
      }
    } else {
      startEdit()
    }
  })
}

function startEdit() {
  editing.value = true
  requestAnimationFrame(() => {
    const input = inputRef.value
    if (input) {
      input.focus()
      input.select()
    }
  })
}

function commitEdit(e: Event) {
  if (!editing.value) return
  const val = +(e.target as HTMLInputElement).value
  const previous = numericValue.value
  editing.value = false
  if (!Number.isNaN(val)) {
    const clamped = Math.min(max, Math.max(min, val))
    emit('update:modelValue', clamped)
    if (clamped !== previous) emit('commit', clamped, previous)
  }
}

function liveUpdate(e: Event) {
  const val = +(e.target as HTMLInputElement).value
  if (!Number.isNaN(val)) {
    const clamped = Math.min(max, Math.max(min, val))
    emit('update:modelValue', clamped)
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.code === 'Enter') commitEdit(e)
  else if (e.code === 'Escape') editing.value = false
}

const ctx = {
  modelValue: toRef(() => modelValue),
  displayValue,
  isMixed,
  editing,
  scrubbing,
  inputRef,
  startScrub,
  startEdit,
  liveUpdate,
  commitEdit,
  onKeydown
}

const actions = {
  startScrub,
  startEdit,
  commitEdit,
  keydown: onKeydown
}

provideScrubInput(ctx)

watch(editing, (v) => emit('editing-change', v))
</script>

<template>
  <slot
    :model-value="modelValue"
    :display-value="displayValue"
    :is-mixed="isMixed"
    :editing="editing"
    :scrubbing="scrubbing"
    :actions="actions"
    :placeholder="placeholder"
  />
</template>
