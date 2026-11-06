<script setup lang="ts">
import type { Effect, Fill } from '@open-pencil/scene-graph'
import { colorToHexRaw } from '@open-pencil/scene-graph/color'
import type { Color } from '@open-pencil/scene-graph/primitives'
import type { EffectBindingProperty } from '@open-pencil/scene-graph/variables'
import {
  useColorBindingProvider,
  type BindingTarget
} from '@open-pencil/vue/controls/binding-provider'
import { useEffectsControls } from '@open-pencil/vue/controls/effects'
import { useI18n } from '@open-pencil/vue/i18n'
import {
  BindableValueRoot,
  type BindableValueActions
} from '@open-pencil/vue/primitives/BindableValue'

import ColorPicker from '@/components/ColorPicker/ColorPicker.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import VariableBindingPicker from '@/components/properties/binding/VariableBindingPicker.vue'
import {
  commitDiscretePropertyListChange,
  useBlendModeGroups
} from '@/components/properties/blend-mode/use'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import { applyPaintMutation, commitPaintMutation } from '@/components/properties/paint/binding'
import PaintValue from '@/components/properties/paint/PaintValue.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import { useSharedStylePicker } from '@/components/properties/shared-style/useSharedStylePicker'
import VariableNumberField from '@/components/properties/VariableNumberField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import FillSwatch from '@/components/ui/paint/FillSwatch.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const effectsCtx = useEffectsControls()
const { panels, common } = useI18n()
const colorProvider = useColorBindingProvider()
const blendModeGroups = useBlendModeGroups()
const {
  visible: stylesVisible,
  hasStyle,
  value: styleValue,
  options: styleOptions,
  update: updateStyle
} = useSharedStylePicker('effect')

/** The binding field of one effect property on every selected layer, such as `effects/0/radius`. */
function effectTargets(
  nodeIds: readonly string[],
  index: number,
  property: EffectBindingProperty
): BindingTarget[] {
  return nodeIds.map((nodeId) => ({ nodeId, path: `effects/${index}/${property}` }))
}

/** A bound colour edits its variable in the layer's mode; an unbound one edits the effect. */
function updateEffectColor(
  binding: BindableValueActions<Color>,
  flush: () => void,
  update: () => void
) {
  if (applyPaintMutation(binding, flush, update)) commitPaintMutation(binding)
}

function effectPreview(effect: Effect): Fill {
  return {
    type: 'SOLID',
    color: effect.color,
    opacity: 1,
    visible: effect.visible
  }
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, selectedNodeIds, flush, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <PanelSection :label="panels.effects" :empty="!isMixed && items.length === 0">
      <template #actions>
        <AppSelect
          v-if="stylesVisible && !hasStyle"
          :model-value="styleValue"
          :options="styleOptions"
          @update:model-value="updateStyle"
        >
          <template #trigger
            ><IconButton :label="panels.effectStyle" data-property="effect-style"
              ><icon-lucide-layout-grid class="size-3.5" /></IconButton
          ></template>
        </AppSelect>
        <IconButton
          :label="panels.addEffect"
          @click="actions.add(effectsCtx.createDefaultEffect())"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <AppSelect
        v-if="stylesVisible && hasStyle"
        :model-value="styleValue"
        :options="styleOptions"
        :label="panels.effectStyle"
        data-property="effect-style"
        class="mb-1.5"
        @update:model-value="updateStyle"
      />

      <p v-if="isMixed" class="text-2xs text-muted">{{ panels.mixedEffectsHelp }}</p>

      <div
        v-for="(effect, index) in items"
        :key="`${index}:${effect.visible ? 'visible' : 'hidden'}`"
        :data-effect-index="index"
        data-effect-group
      >
        <PropertyItemRow
          prop-key="effects"
          :index="index"
          :visibility-label="panels.toggleVisibility"
          :remove-label="panels.removeEffect"
          class="items-start"
          @remove="effectsCtx.adjustExpandedAfterRemove(index)"
        >
          <div class="flex min-w-0 flex-1 flex-col">
            <div class="flex min-w-0 items-center gap-1.5">
              <Tip
                :label="
                  effectsCtx.expandedIndex.value === index
                    ? panels.collapseEffectSettings
                    : panels.expandEffectSettings
                "
              >
                <button
                  type="button"
                  :aria-expanded="effectsCtx.expandedIndex.value === index"
                  :aria-label="
                    effectsCtx.expandedIndex.value === index
                      ? panels.collapseEffectSettings
                      : panels.expandEffectSettings
                  "
                  data-property="effect-expand"
                  class="flex size-5 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded border border-border bg-input p-0"
                  @click="effectsCtx.toggleExpand(index)"
                >
                  <FillSwatch
                    v-if="effectsCtx.isShadow(effect.type)"
                    :fill="effectPreview(effect)"
                    class="size-full border-0"
                  />
                  <icon-lucide-blend v-else class="size-3 text-muted" />
                </button>
              </Tip>

              <AppSelect
                class="min-w-0 flex-1"
                :model-value="effect.type"
                :options="effectsCtx.effectOptions"
                :label="panels.effects"
                data-property="effect-type"
                @update:model-value="
                  effectsCtx.updateType(actions.patch, activeNode, index, $event as Effect['type'])
                "
              />
            </div>
          </div>
        </PropertyItemRow>

        <div
          v-if="effectsCtx.expandedIndex.value === index"
          class="flex flex-col gap-1.5 py-2"
          data-slot="effect-settings"
        >
          <PanelFieldGroup :label="panels.blendMode">
            <AppSelect
              :model-value="effect.blendMode ?? 'NORMAL'"
              :groups="blendModeGroups"
              :label="panels.blendMode"
              data-property="effect-blend-mode"
              @update:model-value="
                commitDiscretePropertyListChange(flush, () =>
                  actions.patch(index, { blendMode: $event as Effect['blendMode'] })
                )
              "
            />
          </PanelFieldGroup>
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <Tip :label="panels.xAxis">
                <VariableNumberField
                  icon="X"
                  :aria-label="panels.xAxis"
                  :model-value="effect.offset.x"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/offsetX`"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                />
              </Tip>
              <Tip :label="panels.yAxis">
                <VariableNumberField
                  icon="Y"
                  :aria-label="panels.yAxis"
                  :model-value="effect.offset.y"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/offsetY`"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <Tip :label="panels.radius">
                <VariableNumberField
                  icon="B"
                  :aria-label="panels.radius"
                  :model-value="effect.radius"
                  :min="0"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/radius`"
                  @update:model-value="effectsCtx.scrubEffect(index, { radius: $event })"
                  @commit="effectsCtx.commitEffect(index, { radius: $event })"
                />
              </Tip>
              <Tip :label="panels.spread">
                <VariableNumberField
                  icon="S"
                  :aria-label="panels.spread"
                  :model-value="effect.spread"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/spread`"
                  @update:model-value="effectsCtx.scrubEffect(index, { spread: $event })"
                  @commit="effectsCtx.commitEffect(index, { spread: $event })"
                />
              </Tip>
            </div>

            <BindableValueRoot
              v-slot="binding"
              :provider="colorProvider"
              :targets="effectTargets(selectedNodeIds, index, 'color')"
              :value="effect.color"
              batch-label="Change effect color"
            >
              <div class="flex items-center gap-1.5" data-property="effect-color">
                <ColorPicker
                  :color="binding.resolvedValue ?? effect.color"
                  @update="
                    updateEffectColor(binding.actions, flush, () =>
                      effectsCtx.updateColor(actions.patch, index, $event)
                    )
                  "
                />
                <PaintValue
                  :color="effect.color"
                  :resolved-color="binding.resolvedValue"
                  :variable-name="binding.variable?.name ?? binding.bindingId"
                  :unavailable-label="
                    binding.state === 'unresolved' ? panels.unresolvedVariable : undefined
                  "
                  :label="panels.effectColor"
                  @update="
                    updateEffectColor(binding.actions, flush, () =>
                      effectsCtx.updateColor(actions.patch, index, $event)
                    )
                  "
                />
                <!-- A bound colour takes its opacity from the variable, as in Figma. -->
                <Tip
                  v-if="!binding.variable && binding.state !== 'unresolved'"
                  :label="panels.opacity"
                >
                  <NumberField
                    class="w-14"
                    suffix="%"
                    :inherit-binding="false"
                    :aria-label="panels.opacity"
                    :model-value="Math.round(effect.color.a * 100)"
                    :min="0"
                    :max="100"
                    data-property="effect-opacity"
                    @update:model-value="
                      effectsCtx.scrubEffect(index, {
                        color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                      })
                    "
                    @commit="
                      effectsCtx.commitEffect(index, {
                        color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                      })
                    "
                  />
                </Tip>
                <VariableBindingPicker
                  :trigger-label="panels.applyVariable"
                  :search-placeholder="common.search"
                  :empty-label="panels.noVariablesFound"
                  :detach-label="panels.detachVariable"
                  :create-label="
                    panels.createColorVariable({ value: `#${colorToHexRaw(effect.color)}` })
                  "
                  :create-name-placeholder="panels.variableName"
                  :create-submit-label="panels.create"
                />
              </div>
            </BindableValueRoot>
          </template>

          <VariableNumberField
            v-else
            class="w-24 flex-none"
            icon="B"
            :aria-label="panels.radius"
            :model-value="effect.radius"
            :min="0"
            :node-id="selectedNodeIds[0] ?? ''"
            :node-ids="selectedNodeIds"
            :binding-path="`effects/${index}/radius`"
            @update:model-value="effectsCtx.scrubEffect(index, { radius: $event })"
            @commit="effectsCtx.commitEffect(index, { radius: $event })"
          />
        </div>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
