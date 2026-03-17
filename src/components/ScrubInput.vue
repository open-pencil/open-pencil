<script setup lang="ts">
import { ScrubInputRoot, ScrubInputField, ScrubInputDisplay } from '@open-pencil/vue'

const { modelValue, min, max, step, icon, label, suffix, sensitivity, placeholder } = defineProps<{
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

const emit = defineEmits<{
  'update:modelValue': [value: number]
  commit: [value: number, previous: number]
}>()
</script>

<template>
  <ScrubInputRoot
    v-slot="{ editing, startScrub, placeholder: ph }"
    :model-value="modelValue"
    :min="min"
    :max="max"
    :step="step"
    :sensitivity="sensitivity"
    :placeholder="placeholder"
    @update:model-value="emit('update:modelValue', $event)"
    @commit="(val: number, prev: number) => emit('commit', val, prev)"
  >
    <div
      data-test-id="scrub-input"
      class="flex h-[26px] min-w-0 flex-1 items-center rounded border border-border bg-input focus-within:border-accent"
      :style="{ cursor: editing ? 'auto' : 'ew-resize' }"
      @pointerdown="!editing && startScrub($event)"
    >
      <span
        class="flex shrink-0 items-center justify-center self-stretch px-[5px] text-muted select-none [&>*]:pointer-events-none"
      >
        <slot name="icon">
          <span v-if="icon" class="text-[11px] leading-none">{{ icon }}</span>
        </slot>
        <span v-if="label" class="text-[11px] leading-none">{{ label }}</span>
      </span>
      <ScrubInputField
        data-test-id="scrub-input-field"
        class="min-w-0 flex-1 cursor-text border-none bg-transparent pr-1.5 font-[inherit] text-xs text-surface outline-none"
        :min="min === -Infinity ? undefined : min"
        :max="max === Infinity ? undefined : max"
        :step="step"
      />
      <ScrubInputDisplay
        class="flex flex-1 items-center truncate overflow-hidden pr-1.5 text-xs select-none"
      >
        <template #default="{ value, isMixed: mixed }">
          <span v-if="mixed" class="flex-1 text-muted">{{ ph }}</span>
          <template v-else>
            <span class="flex-1 text-surface">{{ value }}</span>
            <span v-if="suffix" class="shrink-0 text-muted">{{ suffix }}</span>
          </template>
        </template>
      </ScrubInputDisplay>
    </div>
  </ScrubInputRoot>
</template>
