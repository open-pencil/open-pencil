<script setup lang="ts">
import { computed, ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { AliasCandidate } from '@/app/editor/tokens/model'
import IconButton from '@/components/ui/button/IconButton.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

/** Points a mode's value at another variable, the way Figma's variable picker does. */
const { candidates, selected, label } = defineProps<{
  candidates: AliasCandidate[]
  /** The variable the value points at now, checked in the list. */
  selected?: string
  /** The trigger's accessible name, naming the mode it sets. */
  label: string
}>()
const emit = defineEmits<{ select: [variableId: string] }>()

const { variables, common } = useI18n()
const open = ref(false)

const items = computed<AppPickerItem[]>(() =>
  candidates.map((candidate) => ({
    value: candidate.id,
    label: candidate.name,
    group: candidate.collection
  }))
)

function color(id: string) {
  return candidates.find((candidate) => candidate.id === id)?.color
}
</script>

<template>
  <AppPicker
    v-model:open="open"
    :heading="variables.useVariable"
    :items="items"
    :selected="selected"
    :search-placeholder="variables.searchVariables"
    :empty-label="variables.noMatchingVariables"
    :close-label="common.close"
    density="compact"
    side="left"
    @select="emit('select', $event)"
  >
    <template #trigger>
      <IconButton :label="label" data-test-id="variables-use-variable">
        <icon-lucide-variable class="size-3.5" />
      </IconButton>
    </template>
    <template #leading="{ item }">
      <FillSwatch
        v-if="color(item.value)"
        :fill="{
          type: 'SOLID',
          visible: true,
          opacity: color(item.value)?.a ?? 1,
          color: color(item.value) ?? { r: 0, g: 0, b: 0, a: 1 }
        }"
        :ui="{ root: 'size-3.5 shrink-0 rounded-sm' }"
      />
    </template>
  </AppPicker>
</template>
