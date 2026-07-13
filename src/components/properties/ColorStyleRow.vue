<script setup lang="ts">
import { computed, useAttrs } from 'vue'

import NumberField from '@/components/inputs/NumberField.vue'
import BoundVariableButton from '@/components/properties/BoundVariableButton.vue'
import VariablePickerPopover from '@/components/properties/VariablePickerPopover.vue'
import IconButton from '@/components/ui/IconButton.vue'
import Tip from '@/components/ui/Tip.vue'

import { useI18n, vTestId } from '@open-pencil/vue'

import {
  opacityFromPercent,
  opacityPercent,
  variableSwatchBackground
} from '@/components/properties/color-style-row'
import { colorToHexRaw } from '@open-pencil/core/color'

import type { ColorVariableBindingApi } from '@/components/properties/color-style-row'
import type { Color } from '@open-pencil/scene-graph/primitives'

const { item, index, activeNodeId, bindingApi, variableColor, removeLabel } = defineProps<{
  item: { opacity: number; visible: boolean }
  index: number
  activeNodeId?: string | null
  bindingApi: ColorVariableBindingApi
  variableColor?: Color
  removeLabel: string
}>()

const emit = defineEmits<{
  patch: [changes: Record<string, unknown>]
  toggleVisibility: []
  remove: []
}>()

const { panels, dialogs } = useI18n()
const attrs = useAttrs()
const testPrefix = computed(() => {
  const rowId = attrs['data-test-id']
  if (rowId === 'stroke-item') return 'stroke'
  return 'fill'
})
const visibilityDataTestId = computed(() => `${testPrefix.value}-visibility-${index}`)
const applyVariableDataTestId = computed(() => `${testPrefix.value}-apply-variable-${index}`)
const unbindDataTestId = computed(() => `${testPrefix.value}-unbind-variable`)
</script>

<template>
  <div class="group flex items-center gap-1.5 py-0.5">
    <div class="min-w-0 flex flex-1 items-center gap-1.5">
      <slot />
    </div>

    <Tip :label="panels.opacity">
      <NumberField
        class="w-12 shrink-0"
        suffix="%"
        :model-value="opacityPercent(item.opacity)"
        :min="0"
        :max="100"
        @update:model-value="emit('patch', { opacity: opacityFromPercent($event) })"
      />
    </Tip>

    <VariablePickerPopover
      v-if="
        activeNodeId &&
        (bindingApi.colorVariables.value.length > 0 ||
          (variableColor && bindingApi.createAndBindVariable)) &&
        !bindingApi.getBoundVariable(activeNodeId, index)
      "
      v-model:search-term="bindingApi.searchTerm.value"
      :variables="bindingApi.filteredVariables.value"
      :trigger-label="panels.applyVariable"
      :search-placeholder="dialogs.search"
      :empty-label="panels.noVariablesFound"
      :data-test-id="applyVariableDataTestId"
      :create-label="
        variableColor && bindingApi.createAndBindVariable
          ? panels.createColorVariable({ value: colorToHexRaw(variableColor) })
          : undefined
      "
      :create-name-placeholder="panels.variableName"
      :create-submit-label="panels.create"
      :create-default-name="bindingApi.searchTerm.value"
      :swatch-background="(variableId) => variableSwatchBackground(bindingApi, variableId)"
      @select="activeNodeId && bindingApi.bindVariable(activeNodeId, index, $event.id)"
      @create="
        activeNodeId &&
        variableColor &&
        bindingApi.createAndBindVariable?.(activeNodeId, index, variableColor, $event)
      "
    />

    <BoundVariableButton
      v-else-if="activeNodeId && bindingApi.getBoundVariable(activeNodeId, index)"
      :data-test-id="unbindDataTestId"
      :label="panels.detachVariable"
      @detach="bindingApi.unbindVariable(activeNodeId, index)"
    />

    <Tip :label="panels.toggleVisibility">
      <button
        v-test-id="visibilityDataTestId"
        :data-visible="item.visible ? 'true' : 'false'"
        class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
        @click="emit('toggleVisibility')"
      >
        <icon-lucide-eye v-if="item.visible" data-test-id="visibility-icon-on" class="size-3.5" />
        <icon-lucide-eye-off v-else data-test-id="visibility-icon-off" class="size-3.5" />
      </button>
    </Tip>

    <IconButton :label="removeLabel" class="shrink-0" @click="emit('remove')">
      <icon-lucide-minus class="size-3.5" />
    </IconButton>
  </div>
</template>
