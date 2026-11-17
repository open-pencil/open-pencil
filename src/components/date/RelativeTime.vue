<script setup lang="ts">
import { computed } from 'vue'

import { useDateFormat } from '@/app/i18n/date'
import Tip from '@/components/ui/overlay/Tip.vue'

/** When something happened, as "3 hr. ago", with the exact date and time in a tooltip. */
const { at } = defineProps<{ at: string }>()

const dates = useDateFormat()
const label = computed(() => dates.relative(at))
const exact = computed(() => dates.format(at, 'dateTime'))
</script>

<template>
  <Tip :label="exact" as-child>
    <time :datetime="at">{{ label }}</time>
  </Tip>
</template>
