<script setup lang="ts">
import type { SceneNode, TextLength } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'

import { useTextLength } from './useTextLength'

/** Every selected text layer; the field reads Mixed when their letter spacings differ. */
const { nodes } = defineProps<{ nodes: readonly SceneNode[] }>()
const emit = defineEmits<{
  update: [value: TextLength]
  commit: [value: TextLength, previous: TextLength]
}>()
const { panels } = useI18n()
const { value, suffix, length } = useTextLength(
  () => nodes,
  'letterSpacing',
  () => 0
)
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :suffix="suffix"
    :aria-label="panels.letterSpacing"
    :node-id="nodes.at(0)?.id ?? ''"
    :node-ids="nodes.map((node) => node.id)"
    binding-path="letterSpacing"
    @update:model-value="emit('update', length($event))"
    @commit="(current, previous) => emit('commit', length(current), length(previous))"
  >
    <template #icon>
      <icon-lucide-a-large-small class="size-3" />
    </template>
  </VariableNumberField>
</template>
