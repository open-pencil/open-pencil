<script setup lang="ts">
import { compact } from 'es-toolkit/array'
import { computed } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import type { DesignIssueCounts } from '@/app/editor/design-check/issues'
import Tip from '@/components/ui/overlay/Tip.vue'
import { pageIssueBadge } from '@/theme/design-check'

/**
 * Errors and warnings on a page, like the problem count an IDE shows next to a file. Nothing
 * shows for a page without them, or one not checked yet (`null`).
 */
const { counts } = defineProps<{ counts: DesignIssueCounts | null }>()

const messages = useDesignCheckMessages()
const errors = computed(() => counts?.error ?? 0)
const warnings = computed(() => counts?.warning ?? 0)
const total = computed(() => errors.value + warnings.value)
const severity = computed(() => (errors.value > 0 ? 'error' : 'warning'))
const styles = computed(() => pageIssueBadge({ severity: severity.value }))
const label = computed(() =>
  compact([
    errors.value > 0 ? `${messages.value.errors}: ${errors.value}` : null,
    warnings.value > 0 ? `${messages.value.warnings}: ${warnings.value}` : null
  ]).join(', ')
)
</script>

<template>
  <Tip v-if="total > 0" :label="label">
    <span role="img" :aria-label="label" :data-issue-severity="severity" :class="styles">
      {{ total > 99 ? '99+' : total }}
    </span>
  </Tip>
</template>
