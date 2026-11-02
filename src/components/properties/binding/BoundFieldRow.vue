<script setup lang="ts">
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'

/**
 * A field whose value something else decides, shown in place of the value: the field's label,
 * a chip naming what decides it with its value here, and the actions on that link. A component
 * property and a variable share it, told apart by tone.
 */
const {
  label,
  name,
  value,
  tone = 'variable'
} = defineProps<{
  /** The field, which also names the row for assistive tech. */
  label: string
  /** The property or variable the field follows. */
  name: string
  /** What it holds for this layer, when that helps read the field. */
  value?: string
  tone?: 'component' | 'variable' | 'unresolved'
}>()
defineSlots<{ icon(): unknown; actions(): unknown }>()
</script>

<template>
  <PanelFieldGroup class="mb-1.5" :label="label">
    <div class="flex min-w-0 flex-1 items-center gap-1" role="group" :aria-label="label">
      <span
        class="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded px-2 text-xs"
        :class="{
          'bg-component/15 text-component': tone === 'component',
          'bg-input text-surface': tone === 'variable',
          'bg-error-bg text-error': tone === 'unresolved'
        }"
      >
        <slot name="icon" />
        <span class="truncate">{{ name }}</span>
        <span v-if="value !== undefined" class="ml-auto max-w-1/2 min-w-0 truncate text-muted">
          {{ value }}
        </span>
      </span>
      <slot name="actions" />
    </div>
  </PanelFieldGroup>
</template>
