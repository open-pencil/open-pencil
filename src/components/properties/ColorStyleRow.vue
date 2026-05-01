<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import BoundVariableButton from '@/components/properties/BoundVariableButton.vue'
import VariablePickerPopover from '@/components/properties/VariablePickerPopover.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'

import { useI18n } from '@open-pencil/vue'

import {
  opacityFromPercent,
  opacityPercent,
  variableSwatchBackground
} from '@/components/properties/color-style-row'
import { colorToHexRaw } from '@open-pencil/core/color'

import type { ColorVariableBindingApi } from '@/components/properties/color-style-row'
import type { Color } from '@open-pencil/core/types'

const {
  item,
  index,
  activeNodeId,
  bindingApi,
  visibilityTestId,
  applyVariableTestId,
  unbindTestId,
  variableColor
} = defineProps<{
  item: { opacity: number; visible: boolean }
  index: number
  activeNodeId?: string | null
  bindingApi: ColorVariableBindingApi
  visibilityTestId: string
  applyVariableTestId?: string
  unbindTestId?: string
  variableColor?: Color
}>()

const emit = defineEmits<{
  patch: [changes: Record<string, unknown>]
  toggleVisibility: []
  remove: []
}>()

const { panels, dialogs } = useI18n()
</script>

<template>
  <div class="group flex items-center gap-1.5 py-0.5">
    <div class="min-w-0 flex flex-1 items-center gap-1.5">
      <slot />
    </div>

    <ScrubInput
      class="w-12 shrink-0"
      suffix="%"
      :model-value="opacityPercent(item.opacity)"
      :min="0"
      :max="100"
      @update:model-value="emit('patch', { opacity: opacityFromPercent($event) })"
    />

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
      :trigger-test-id="applyVariableTestId"
      :create-label="
        variableColor && bindingApi.createAndBindVariable
          ? panels.createColorVariable({ value: colorToHexRaw(variableColor) })
          : undefined
      "
      :create-name-placeholder="panels.variableName"
      :create-submit-label="panels.create"
      :create-default-name="bindingApi.searchTerm.value"
      :create-test-id="applyVariableTestId ? `${applyVariableTestId}-create` : undefined"
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
      :test-id="unbindTestId"
      :label="panels.detachVariable"
      @detach="bindingApi.unbindVariable(activeNodeId, index)"
    />

    <button
      :data-test-id="visibilityTestId"
      :data-visible="item.visible ? 'true' : 'false'"
      class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
      @click="emit('toggleVisibility')"
    >
      <icon-lucide-eye v-if="item.visible" class="size-3.5" />
      <icon-lucide-eye-off v-else class="size-3.5" />
    </button>

    <button :class="useIconButtonUI({ ui: { base: 'shrink-0' } }).base" @click="emit('remove')">
      −
    </button>
  </div>
</template>
