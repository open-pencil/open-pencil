<script setup lang="ts">
import { tv } from 'tailwind-variants'

import theme from '@/theme/settings/toolbar/joint'

/** Where two rows meet, showing the line where a dragged row would land. */
const { kind, dropping } = defineProps<{
  kind: 'inside' | 'between' | 'end'
  dropping: boolean
}>()

const styles = tv(theme)
</script>

<template>
  <div :class="styles({ kind }).root()">
    <span v-if="dropping" :class="styles().line()" />
  </div>
</template>
