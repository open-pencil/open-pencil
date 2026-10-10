<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { formatCommentTime, useCommentClock } from '@/app/comments/time'

const { at } = defineProps<{ at: string }>()

const now = useCommentClock()
const { locale } = useI18n()
const label = computed(() => formatCommentTime(at, now.value.getTime(), locale.value))
</script>

<template>
  <time :datetime="at">{{ label }}</time>
</template>
