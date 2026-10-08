<script setup lang="ts">
import { ref, watch } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'

import AppInput from '@/components/ui/input/AppInput.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/** A property default: text commits on change or Enter, a boolean toggles, a swap picks. */
const {
  kind,
  value,
  label,
  disabled,
  options = []
} = defineProps<{
  kind: ComponentPropertyType
  value: string
  label: string
  disabled?: boolean
  options?: { value: string; label: string; disabled?: boolean }[]
}>()
const emit = defineEmits<{ update: [value: string] }>()
const draft = ref(value)
watch(
  () => value,
  (next) => {
    draft.value = next
  }
)
function commit() {
  if (!disabled && draft.value !== value) emit('update', draft.value)
}
</script>

<template>
  <AppSwitch
    v-if="kind === 'BOOLEAN'"
    :label="label"
    :model-value="value === 'true'"
    :disabled="disabled"
    @update:model-value="emit('update', String($event))"
  />
  <AppInput
    v-else-if="kind === 'TEXT'"
    v-model="draft"
    :aria-label="label"
    size="sm"
    tone="panel"
    :disabled="disabled"
    @change="commit"
    @enter="commit"
  />
  <AppSelect
    v-else
    class="w-full"
    :label="label"
    :model-value="value"
    :options="options"
    :disabled="disabled"
    @update:model-value="emit('update', $event)"
  />
</template>
