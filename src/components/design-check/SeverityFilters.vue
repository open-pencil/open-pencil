<script setup lang="ts">
import { ToggleGroupItem, ToggleGroupRoot } from 'reka-ui'
import { computed } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import {
  DESIGN_ISSUE_SEVERITIES,
  type DesignIssueCounts,
  type DesignIssueSeverity
} from '@/app/editor/design-check/issues'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { designCheck } from '@/theme/design-check'

const { counts } = defineProps<{ counts: DesignIssueCounts }>()
/** Severities whose issues are listed; toggling one hides or shows its issues. */
const visible = defineModel<DesignIssueSeverity[]>({ required: true })

const messages = useDesignCheckMessages()
const styles = designCheck()

const labels = computed<Record<DesignIssueSeverity, string>>(() => ({
  error: messages.value.errors,
  warning: messages.value.warnings,
  info: messages.value.suggestions
}))

function update(value: unknown) {
  const selected: unknown[] = Array.isArray(value) ? value : []
  visible.value = DESIGN_ISSUE_SEVERITIES.filter((severity) => selected.includes(severity))
}
</script>

<template>
  <ToggleGroupRoot
    type="multiple"
    :model-value="visible"
    :aria-label="messages.filterSeverities"
    :class="styles.filters()"
    @update:model-value="update"
  >
    <Tip
      v-for="severity in DESIGN_ISSUE_SEVERITIES"
      :key="severity"
      as-child
      :label="messages.filterBySeverity({ severity: labels[severity] })"
    >
      <ToggleGroupItem
        :value="severity"
        :aria-label="`${labels[severity]}: ${counts[severity]}`"
        :class="styles.filter()"
      >
        <SeverityIcon :severity="severity" />
        {{ counts[severity] }}
      </ToggleGroupItem>
    </Tip>
  </ToggleGroupRoot>
</template>
