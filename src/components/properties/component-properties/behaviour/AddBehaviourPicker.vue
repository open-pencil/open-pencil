<script setup lang="ts">
import { computed } from 'vue'

import { BEHAVIOUR_CONTRACTS, type BehaviourKind } from '@open-pencil/core/behaviours'
import { useI18n } from '@open-pencil/vue'

import IconButton from '@/components/ui/button/IconButton.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'

import { useBehaviourLabels } from './labels'

/** The section's + : the controls a component can behave as. */
const emit = defineEmits<{ add: [kind: BehaviourKind] }>()
const { panels, common } = useI18n()
const labels = useBehaviourLabels()

const items = computed<AppPickerItem[]>(() =>
  BEHAVIOUR_CONTRACTS.map((contract) => ({
    value: contract.kind,
    label: labels.value.kind(contract.kind).label,
    description: labels.value.kind(contract.kind).description
  }))
)

function add(value: string) {
  const contract = BEHAVIOUR_CONTRACTS.find((item) => item.kind === value)
  if (contract) emit('add', contract.kind)
}
</script>

<template>
  <AppPicker
    :heading="panels.addBehaviour"
    :items="items"
    :search-placeholder="panels.searchBehaviours"
    :empty-label="panels.noBehavioursFound"
    :close-label="common.close"
    @select="add"
  >
    <template #trigger>
      <IconButton :label="panels.addBehaviour" data-property="add-behaviour">
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>
    <template #leading>
      <icon-lucide-mouse-pointer-click class="size-3.5 text-component" />
    </template>
  </AppPicker>
</template>
