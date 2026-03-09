<script setup lang="ts">
import { ref, computed } from 'vue'
import { useEventListener } from '@vueuse/core'

const { modelValue, min = -Infinity, max = Infinity, step = 1, icon, label, suffix, sensitivity = 1, placeholder = 'Mixed' } = defineProps<{
  modelValue: number | symbol
  min?: number
  max?: number
  step?: number
  icon?: string
  label?: string
  suffix?: string
  sensitivity?: number
  placeholder?: string
}>()

const isMixed = computed(() => typeof modelValue === 'symbol')

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
}>()

const editing = ref(false)
const inputRef = ref<HTMLInputElement | null>(null)
const scrubbing = ref(false)

let stopMove: (() => void) | undefined
let stopUp: (() => void) | undefined

const numericValue = computed(() => (isMixed.value ? 0 : (modelValue as number)))
const displayValue = computed(() => (isMixed.value ? '' : Math.round(numericValue.value)))

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
      if (clamped !== modelValue) {
        emit('update:modelValue', clamped)
      }
    }
  })

  stopUp = useEventListener(document, 'pointerup', () => {
    scrubbing.value = false
    document.body.style.cursor = ''
    stopMove?.()
    stopUp?.()
    if (hasMoved) {
      if (modelValue !== valueBeforeScrub) {
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
    inputRef.value?.select()
  })
}

function commitEdit(e: Event) {
  const val = +(e.target as HTMLInputElement).value
  const previous = numericValue.value
  if (!Number.isNaN(val)) {
    const clamped = Math.min(max, Math.max(min, val))
    emit('update:modelValue', clamped)
    if (clamped !== previous) {
      emit('commit', clamped, previous)
    }
  }
  editing.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    commitEdit(e)
  } else if (e.key === 'Escape') {
    editing.value = false
  }
}
</script>

<template>
  <div
    data-test-id="scrub-input"
    class="flex min-w-0 flex-1 items-center rounded border border-border bg-input h-[26px] focus-within:border-accent"
    :style="{ cursor: editing ? 'auto' : 'ew-resize' }"
    @pointerdown="!editing && startScrub($event)"
  >
    <span
      class="flex shrink-0 select-none items-center justify-center self-stretch px-[5px] text-muted [&>*]:pointer-events-none"
    >
      <slot name="icon">
        <span v-if="icon" class="text-[11px] leading-none">{{ icon }}</span>
      </slot>
      <span v-if="label" class="text-[11px] leading-none">{{ label }}</span>
    </span>
    <input
      v-if="editing"
      ref="inputRef"
      type="number"
      data-test-id="scrub-input-field"
      class="min-w-0 flex-1 cursor-text border-none bg-transparent pr-1.5 font-[inherit] text-xs text-surface outline-none"
      :value="isMixed ? '' : displayValue"
      :placeholder="placeholder"
      :min="min === -Infinity ? undefined : min"
      :max="max === Infinity ? undefined : max"
      :step="step"
      @blur="commitEdit"
      @keydown="onKeydown"
    />
    <span
      v-else
      class="flex flex-1 select-none items-center truncate pr-1.5 text-xs overflow-hidden"
    >
      <span v-if="isMixed" class="flex-1 text-muted">{{ placeholder }}</span>
      <template v-else>
        <span class="flex-1 text-surface">{{ displayValue }}</span>
        <span v-if="suffix" class="shrink-0 text-muted">{{ suffix }}</span>
      </template>
    </span>
  </div>
</template>
