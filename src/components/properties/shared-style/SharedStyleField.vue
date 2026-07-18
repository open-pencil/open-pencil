<script setup lang="ts">
import { computed } from 'vue'

import { MIXED, useI18n, useSharedStyleBinding } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'

import type { SharedStyleKind } from '@open-pencil/scene-graph'

interface SharedStyleFieldProps {
  kind: SharedStyleKind
  label: string
}

const { kind, label } = defineProps<SharedStyleFieldProps>()
const { panels } = useI18n()
const binding = useSharedStyleBinding(kind)
const { active, styleId, styles } = binding
const visible = computed(
  () =>
    active.value && (styles.value.length > 0 || styleId.value === MIXED || styleId.value !== null)
)
const options = computed(() => {
  const result: Array<{ value: string; label: string }> = [
    { value: 'NONE', label: panels.value.none }
  ]
  if (styleId.value === MIXED) result.unshift({ value: 'MIXED', label: panels.value.mixed })
  for (const style of styles.value) result.push({ value: style.id, label: style.name })
  if (
    typeof styleId.value === 'string' &&
    !styles.value.some((style) => style.id === styleId.value)
  ) {
    result.push({ value: styleId.value, label: panels.value.missingStyle({ id: styleId.value }) })
  }
  return result
})

function update(value: string) {
  if (value === 'MIXED') return
  if (value === 'NONE') binding.unbind()
  else binding.bind(value)
}
</script>

<template>
  <PanelGrid v-if="visible" columns="fill" class="mb-1.5">
    <PanelFieldGroup :label="label">
      <AppSelect
        :model-value="styleId === MIXED ? 'MIXED' : (styleId ?? 'NONE')"
        :options="options"
        :label="label"
        :data-property="`${kind}-style`"
        @update:model-value="update"
      />
    </PanelFieldGroup>
  </PanelGrid>
</template>
