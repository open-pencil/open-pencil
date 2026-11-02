<script setup lang="ts">
import { computed } from 'vue'

import { useDateFormat } from '@/app/i18n/date'

const { at } = defineProps<{ at: string }>()

const dates = useDateFormat()
const label = computed(() => dates.relative(at))
</script>

<template>
  <time :datetime="at">{{ label }}</time>
</template>
