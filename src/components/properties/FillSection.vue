<script setup lang="ts">
import {
  BindableValueRoot,
  useColorBindingProvider,
  useFillControls,
  useI18n,
  useOkHCL
} from '@open-pencil/vue'

import FillPicker from '@/components/fill-picker/FillPicker.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import PaintField from '@/components/properties/paint/PaintField.vue'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import {
  applyPaintMutation,
  cancelPaintMutation,
  commitPaintMutation,
  paintBindingTargets
} from '@/components/properties/paint/binding'
import { fillLabel } from '@/components/properties/fill-label'
import { createFillOkhclAdapter } from '@/components/properties/paint/okhcl'
import {
  commitDiscretePropertyListChange,
  useBlendModeOptions
} from '@/components/properties/blend-mode/use'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

import { colorToHexRaw } from '@open-pencil/core/color'
import type { Fill } from '@open-pencil/scene-graph'
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { BindableValueActions } from '@open-pencil/vue'

const fillCtx = useFillControls()
const okhcl = useOkHCL()
const colorProvider = useColorBindingProvider()
const { panels, dialogs } = useI18n()
const blendModeOptions = useBlendModeOptions()

function displayFill(fill: Fill, resolvedColor: Color | undefined): Fill {
  return fill.type === 'SOLID' && resolvedColor ? { ...fill, color: resolvedColor } : fill
}

function updatePickerFill(
  binding: BindableValueActions<Color>,
  flush: () => void,
  nextFill: Fill,
  update: (fill: Fill) => void
) {
  applyPaintMutation(binding, flush, () => update(nextFill))
}

function updateSolidColor(
  binding: BindableValueActions<Color>,
  flush: () => void,
  fill: Fill,
  color: Color,
  update: (fill: Fill) => void
) {
  if (fill.type !== 'SOLID') return
  if (applyPaintMutation(binding, flush, () => update({ ...fill, color })))
    commitPaintMutation(binding)
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, selectedNodeIds, flush, actions }"
    prop-key="fills"
    :label="panels.fill"
  >
    <PanelSection :label="panels.fill" :empty="!isMixed && items.length === 0">
      <template #actions>
        <IconButton :label="panels.addFill" @click="actions.add({ ...fillCtx.defaultFill })">
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <SharedStyleField kind="fill" :label="panels.fillStyle" />

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedFillsHelp }}</p>

      <div v-for="(fill, index) in items" :key="`${index}:${fill.visible ? 'visible' : 'hidden'}`">
        <PropertyItemRow
          class="items-start"
          prop-key="fills"
          :index="index"
          :visibility-label="panels.toggleVisibility"
          :remove-label="panels.removeFill"
        >
          <div class="flex min-w-0 flex-1 flex-col gap-1.5">
            <BindableValueRoot
              v-slot="binding"
              :provider="colorProvider"
              :targets="paintBindingTargets(selectedNodeIds, 'fills', index)"
              :value="fill.color"
              batch-label="Change fill color"
            >
              <PaintField
                class="w-full flex-none"
                :opacity="fill.opacity"
                :opacity-label="panels.opacity"
                @update:opacity="actions.patch(index, { opacity: $event })"
              >
                <template #preview>
                  <FillPicker
                    :fill="displayFill(fill, binding.resolvedValue)"
                    :okhcl="createFillOkhclAdapter(okhcl, activeNode, index)"
                    @update="
                      updatePickerFill(binding.actions, flush, $event, (next) =>
                        actions.update(index, next)
                      )
                    "
                    @open-change="!$event && commitPaintMutation(binding.actions)"
                    @cancel="cancelPaintMutation(binding.actions)"
                  />
                </template>

                <template #value>
                  <PaintValue
                    v-if="fill.type === 'SOLID'"
                    :color="fill.color"
                    :resolved-color="binding.resolvedValue"
                    :variable-name="binding.variable?.name"
                    :label="panels.fill"
                    @update="
                      updateSolidColor(binding.actions, flush, fill, $event, (next) =>
                        actions.update(index, next)
                      )
                    "
                  />
                  <span v-else class="min-w-0 flex-1 truncate font-mono text-xs text-surface">
                    {{ fillLabel(fill) }}
                  </span>
                </template>

                <template v-if="fill.type === 'SOLID'" #binding>
                  <VariableBindingPicker
                    :trigger-label="panels.applyVariable"
                    :search-placeholder="dialogs.search"
                    :empty-label="panels.noVariablesFound"
                    :detach-label="panels.detachVariable"
                    :create-label="
                      panels.createColorVariable({ value: `#${colorToHexRaw(fill.color)}` })
                    "
                    :create-name-placeholder="panels.variableName"
                    :create-submit-label="panels.create"
                  />
                </template>
              </PaintField>
            </BindableValueRoot>
            <PanelFieldGroup :label="panels.blendMode">
              <AppSelect
                :model-value="fill.blendMode ?? 'NORMAL'"
                :options="blendModeOptions"
                :label="panels.blendMode"
                data-property="fill-blend-mode"
                @update:model-value="
                  commitDiscretePropertyListChange(flush, () =>
                    actions.patch(index, { blendMode: $event as Fill['blendMode'] })
                  )
                "
              />
            </PanelFieldGroup>
          </div>
        </PropertyItemRow>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
