<script setup lang="ts">
import { computed, useId, useSlots } from 'vue'

import { alert, type AlertProps } from './alert'
const { heading, description, tone = 'info', ui } = defineProps<AlertProps>()
const slots = useSlots()
const id = useId()
const role = computed(() => (tone === 'error' || tone === 'warning' ? 'alert' : 'status'))
const styles = computed(() => {
  const theme = alert({ tone })
  return {
    root: theme.root({ class: ui?.root }),
    icon: theme.icon({ class: ui?.icon }),
    content: theme.content({ class: ui?.content }),
    heading: theme.heading({ class: ui?.heading }),
    description: theme.description({ class: ui?.description }),
    details: theme.details({ class: ui?.details }),
    actions: theme.actions({ class: ui?.actions })
  }
})
</script>

<template>
  <div
    :class="styles.root"
    :role="role"
    :data-tone="tone"
    data-slot="alert"
    :aria-labelledby="`${id}-heading`"
    aria-atomic="true"
  >
    <icon-lucide-circle-alert v-if="tone === 'error'" :class="styles.icon" aria-hidden="true" />
    <icon-lucide-triangle-alert
      v-else-if="tone === 'warning'"
      :class="styles.icon"
      aria-hidden="true"
    />
    <icon-lucide-circle-check
      v-else-if="tone === 'success'"
      :class="styles.icon"
      aria-hidden="true"
    />
    <icon-lucide-info v-else :class="styles.icon" aria-hidden="true" />
    <div :class="styles.content">
      <p :id="`${id}-heading`" :class="styles.heading" data-slot="alert-heading">{{ heading }}</p>
      <div
        v-if="description || slots.default"
        :class="styles.description"
        data-slot="alert-description"
      >
        <slot>{{ description }}</slot>
      </div>
      <div v-if="slots.details" :class="styles.details" data-slot="alert-details">
        <slot name="details" />
      </div>
      <div v-if="slots.actions" :class="styles.actions" data-slot="alert-actions">
        <slot name="actions" />
      </div>
    </div>
  </div>
</template>
