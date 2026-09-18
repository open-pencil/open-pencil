<script setup lang="ts">
import { MIXED, type MixedValue } from '@open-pencil/vue'

import AppInput from '@/components/ui/input/AppInput.vue'

const { value, label } = defineProps<{ value: MixedValue<string>; label: string }>()
const emit = defineEmits<{ update: [value: string]; commit: [] }>()
</script>

<template>
  <AppInput
    :model-value="value === MIXED ? '' : value"
    tone="panel"
    size="sm"
    :state="value === MIXED ? 'mixed' : 'idle'"
    :placeholder="value === MIXED ? '—' : undefined"
    :aria-label="label"
    @update:model-value="emit('update', String($event))"
    @blur="emit('commit')"
    @enter="emit('commit')"
  />
</template>
