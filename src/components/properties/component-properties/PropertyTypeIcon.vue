<script setup lang="ts">
import type { ComponentPropertyType } from '@open-pencil/scene-graph'
const { kind } = defineProps<{ kind: ComponentPropertyType }>()
</script>
<template>
  <icon-lucide-eye
    v-if="kind === 'BOOLEAN'"
    class="size-3.5 shrink-0 text-muted"
    aria-hidden="true"
  />
  <icon-lucide-type
    v-else-if="kind === 'TEXT'"
    class="size-3.5 shrink-0 text-muted"
    aria-hidden="true"
  />
  <icon-lucide-component v-else class="size-3.5 shrink-0 text-muted" aria-hidden="true" />
</template>
