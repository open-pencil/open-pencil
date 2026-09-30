<script setup lang="ts">
import type { DesignIssueSeverity } from '@/app/editor/design-check/issues'
import { severityIcon } from '@/theme/design-check'

const { severity, class: className } = defineProps<{
  severity: DesignIssueSeverity
  class?: string
}>()
</script>

<template>
  <icon-lucide-circle-alert
    v-if="severity === 'error'"
    aria-hidden="true"
    :class="severityIcon({ severity, class: className })"
  />
  <icon-lucide-triangle-alert
    v-else-if="severity === 'warning'"
    aria-hidden="true"
    :class="severityIcon({ severity, class: className })"
  />
  <icon-lucide-lightbulb
    v-else
    aria-hidden="true"
    :class="severityIcon({ severity, class: className })"
  />
</template>
