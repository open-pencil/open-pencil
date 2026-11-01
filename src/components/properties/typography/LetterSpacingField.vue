<script setup lang="ts">
import type { SceneNode, TextLength } from '@open-pencil/scene-graph'
import { useI18n } from '@open-pencil/vue/i18n'

import VariableNumberField from '@/components/properties/VariableNumberField.vue'

import { TEXT_LENGTH_UNITS, useTextLength } from './useTextLength'

/** Every selected text layer; the field reads Mixed when their letter spacings differ. */
const { nodes } = defineProps<{ nodes: readonly SceneNode[] }>()
const emit = defineEmits<{
  update: [value: TextLength]
  commit: [value: TextLength, previous: TextLength]
  cancel: []
}>()
const { panels } = useI18n()
const { value, suffix, length } = useTextLength(
  () => nodes,
  'letterSpacing',
  () => 0
)
/** The panel commits what it previewed, so a typed unit is previewed first. */
function commit(current: number, previous: number, unit?: string) {
  if (unit) emit('update', length(current, unit))
  emit('commit', length(current, unit), length(previous))
}
</script>

<template>
  <VariableNumberField
    :model-value="value"
    :suffix="suffix"
    :aria-label="panels.letterSpacing"
    :node-id="nodes.at(0)?.id ?? ''"
    :node-ids="nodes.map((node) => node.id)"
    :units="TEXT_LENGTH_UNITS"
    binding-path="letterSpacing"
    @update:model-value="(value, unit) => emit('update', length(value, unit))"
    @commit="commit"
    @cancel="emit('cancel')"
  >
    <template #icon>
      <icon-lucide-a-large-small class="size-3" />
    </template>
  </VariableNumberField>
</template>
