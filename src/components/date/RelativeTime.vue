<script setup lang="ts">
import { computed } from 'vue'

import { useDateFormat } from '@/app/i18n/date'
import Tip from '@/components/ui/overlay/Tip.vue'

// Tip has two roots, the trigger and its teleported content, so a caller's class goes on `time`.
defineOptions({ inheritAttrs: false })

/** When something happened, as "3 hr. ago", with the exact date and time in a tooltip. */
const { at } = defineProps<{ at: string }>()

const dates = useDateFormat()
const label = computed(() => dates.relative(at))
const exact = computed(() => dates.format(at, 'dateTime'))
</script>

<template>
  <Tip :label="exact" as-child>
    <time v-bind="$attrs" :datetime="at">{{ label }}</time>
  </Tip>
</template>
