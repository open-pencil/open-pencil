<script setup lang="ts">
import { useId } from 'vue'

import { useSettingsSectionHeading } from './heading'
import SettingsResetButton from './SettingsResetButton.vue'

/**
 * A titled block of settings. A setting edited as a whole, such as the toolbar's layout, is
 * `modified` on its section, which then offers the same Reset to default as a changed row does.
 */
const { modified = false } = defineProps<{
  /** The section's setting differs from its default. */
  modified?: boolean
}>()
const emit = defineEmits<{ reset: [] }>()
const headingId = useId()
const heading = useSettingsSectionHeading()
</script>

<template>
  <section class="flex flex-col gap-3" :aria-labelledby="headingId">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0 flex-1">
        <component :is="heading" :id="headingId" class="text-xs font-semibold text-surface">
          <slot name="title" />
        </component>
        <p v-if="$slots.description" class="mt-1 text-2xs text-muted">
          <slot name="description" />
        </p>
      </div>
      <div v-if="modified || $slots.actions" class="flex shrink-0 items-center gap-1">
        <SettingsResetButton v-if="modified" @reset="emit('reset')" />
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </section>
</template>
