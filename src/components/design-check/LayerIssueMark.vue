<script setup lang="ts">
import { computed } from 'vue'

import { useDesignCheckMessages } from '@open-pencil/vue'

import type { LayerIssueMark } from '@/app/editor/design-check/layers'
import SeverityIcon from '@/components/ui/feedback/SeverityIcon.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import { layerIssueMark } from '@/theme/design-check'

/** A layer's own issues show as their severity icon; issues inside it as a dot. */
const { mark } = defineProps<{ mark: LayerIssueMark }>()

const messages = useDesignCheckMessages()
const styles = computed(() => layerIssueMark({ severity: mark.severity }))
const label = computed(() =>
  mark.own ? messages.value.layerIssues({ count: mark.count }) : messages.value.layerContainsIssues
)
</script>

<template>
  <Tip :label="label">
    <span
      role="img"
      :aria-label="label"
      :data-issue-severity="mark.severity"
      :data-issue-own="mark.own || undefined"
      :class="styles.root()"
    >
      <SeverityIcon v-if="mark.own" :severity="mark.severity" />
      <span v-else :class="styles.dot()" />
    </span>
  </Tip>
</template>
