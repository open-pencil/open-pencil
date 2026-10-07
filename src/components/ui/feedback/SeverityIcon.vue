<script setup lang="ts">
import type { DesignIssueSeverity } from '@open-pencil/core/canvas'

import { severityIcon } from '@/theme/feedback/severity'

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
