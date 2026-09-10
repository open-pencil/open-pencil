<script setup lang="ts">
import { computed } from 'vue'

import type { EditorPreparationProgress } from '@/app/editor/preparation/types'
import { preparationPercent } from '@/components/preparation/presentation'
import { motionStyles } from '@/theme/motion/styles'

const { progress } = defineProps<{
  progress: EditorPreparationProgress | null
}>()

const percent = computed(() => preparationPercent(progress))
</script>

<template>
  <span
    role="progressbar"
    :aria-valuenow="percent ?? undefined"
    :aria-valuemin="percent === null ? undefined : 0"
    :aria-valuemax="percent === null ? undefined : 100"
    aria-label="Preparing document"
    class="relative flex size-3 shrink-0 items-center justify-center text-accent"
  >
    <icon-lucide-loader-circle class="size-3" :class="motionStyles.spinner" />
  </span>
</template>
