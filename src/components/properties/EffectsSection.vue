<script setup lang="ts">
import type { Effect, Fill, GlassEffectParams } from '@open-pencil/scene-graph'
import { colorToHexRaw } from '@open-pencil/scene-graph/color'
import { UNSET_GLASS } from '@open-pencil/scene-graph/constants'
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
import PaintField from '@/components/inputs/PaintField.vue'
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
import { fillSwatchTrigger } from '@/components/ui/paint/swatch-trigger'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

const effectsCtx = useEffectsControls()
const { panels, common } = useI18n()
// An effect's preview toggles its settings; it is a swatch for shadows and an icon otherwise.
const effectPreviewButton = fillSwatchTrigger({ size: 'md', framed: true }).root()
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

/** `effect` with one glass value changed, the rest kept. */
function glassChange<K extends keyof GlassEffectParams>(
  effect: Effect,
  key: K,
  value: GlassEffectParams[K]
): Partial<Effect> {
  return { glass: { ...(effect.glass ?? UNSET_GLASS), [key]: value } }
}

/** A percentage field's value as Figma's 0–1 glass amount. */
function fraction(percent: number): number {
  return Math.max(0, Math.min(1, percent / 100))
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
                  :class="effectPreviewButton"
                  @click="effectsCtx.toggleExpand(index)"
                >
                  <FillSwatch
                    v-if="effectsCtx.isShadow(effect.type)"
                    :fill="effectPreview(effect)"
                    class="size-full border-0"
                  />
                  <icon-lucide-gem v-else-if="effect.type === 'GLASS'" class="size-3 text-muted" />
                  <icon-lucide-layers-2
                    v-else-if="effect.type === 'BACKGROUND_BLUR'"
                    class="size-3 text-muted"
                  />
                  <icon-lucide-droplets v-else class="size-3 text-muted" />
                </button>
              </Tip>

              <AppSelect
                class="min-w-0 flex-1"
                :model-value="effect.type"
                :options="effectsCtx.effectOptionsFor(items, index)"
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
          <PanelFieldGroup v-if="effectsCtx.isShadow(effect.type)" :label="panels.blendMode">
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
            <PanelFieldGroup :label="panels.position">
              <PanelGrid :columns="2">
                <VariableNumberField
                  icon="X"
                  :aria-label="panels.xAxis"
                  :model-value="effect.offset.x"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/offsetX`"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, { offset: { ...effect.offset, x: $event } })
                  "
                  @commit="
                    effectsCtx.commitEffect(index, { offset: { ...effect.offset, x: $event } })
                  "
                />
                <VariableNumberField
                  icon="Y"
                  :aria-label="panels.yAxis"
                  :model-value="effect.offset.y"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/offsetY`"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, { offset: { ...effect.offset, y: $event } })
                  "
                  @commit="
                    effectsCtx.commitEffect(index, { offset: { ...effect.offset, y: $event } })
                  "
                />
              </PanelGrid>
            </PanelFieldGroup>

            <PanelGrid :columns="2">
              <PanelFieldGroup :label="panels.blur">
                <VariableNumberField
                  :aria-label="panels.blur"
                  :model-value="effect.radius"
                  :min="0"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/radius`"
                  @update:model-value="effectsCtx.scrubEffect(index, { radius: $event })"
                  @commit="effectsCtx.commitEffect(index, { radius: $event })"
                >
                  <template #icon><icon-lucide-droplet class="size-3" /></template>
                </VariableNumberField>
              </PanelFieldGroup>
              <PanelFieldGroup :label="panels.spread">
                <VariableNumberField
                  :aria-label="panels.spread"
                  :model-value="effect.spread"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/spread`"
                  @update:model-value="effectsCtx.scrubEffect(index, { spread: $event })"
                  @commit="effectsCtx.commitEffect(index, { spread: $event })"
                >
                  <template #icon><icon-lucide-expand class="size-3" /></template>
                </VariableNumberField>
              </PanelFieldGroup>
            </PanelGrid>

            <BindableValueRoot
              v-slot="binding"
              :provider="colorProvider"
              :targets="effectTargets(selectedNodeIds, index, 'color')"
              :value="effect.color"
              batch-label="Change effect color"
            >
              <PanelFieldGroup :label="panels.effectColor">
                <!-- A bound colour takes its opacity from the variable, as in Figma. -->
                <PaintField
                  class="w-full flex-none"
                  data-property="effect-color"
                  :opacity="
                    binding.variable || binding.state === 'unresolved' ? undefined : effect.color.a
                  "
                  :opacity-label="panels.opacity"
                  @update:opacity="
                    effectsCtx.updateColor(actions.patch, index, { ...effect.color, a: $event })
                  "
                >
                  <template #preview>
                    <ColorPicker
                      :color="binding.resolvedValue ?? effect.color"
                      @update="
                        updateEffectColor(binding.actions, flush, () =>
                          effectsCtx.updateColor(actions.patch, index, $event)
                        )
                      "
                    />
                  </template>
                  <template #value>
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
                  </template>
                  <template #binding>
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
                  </template>
                </PaintField>
              </PanelFieldGroup>
            </BindableValueRoot>

            <label
              v-if="effect.type === 'DROP_SHADOW'"
              class="flex cursor-pointer items-center gap-2 text-xs text-surface"
            >
              <AppCheckbox
                :model-value="effect.showShadowBehindNode !== false"
                :ariaLabel="panels.showShadowBehind"
                data-property="effect-show-behind"
                @update:model-value="
                  effectsCtx.commitEffect(index, { showShadowBehindNode: $event })
                "
              />
              {{ panels.showShadowBehind }}
            </label>
          </template>

          <template v-else-if="effect.type === 'GLASS'">
            <PanelGrid :columns="2">
              <PanelFieldGroup :label="panels.glassLightAngle">
                <NumberField
                  suffix="°"
                  :inherit-binding="false"
                  :aria-label="panels.glassLightAngle"
                  :model-value="(effect.glass ?? UNSET_GLASS).lightAngle"
                  data-property="glass-light-angle"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, glassChange(effect, 'lightAngle', $event))
                  "
                  @commit="
                    effectsCtx.commitEffect(index, glassChange(effect, 'lightAngle', $event))
                  "
                >
                  <template #icon><icon-lucide-rotate-cw class="size-3" /></template>
                </NumberField>
              </PanelFieldGroup>
              <PanelFieldGroup :label="panels.glassLightIntensity">
                <NumberField
                  suffix="%"
                  :inherit-binding="false"
                  :aria-label="panels.glassLightIntensity"
                  :model-value="Math.round((effect.glass ?? UNSET_GLASS).lightIntensity * 100)"
                  :min="0"
                  :max="100"
                  data-property="glass-light-intensity"
                  @update:model-value="
                    effectsCtx.scrubEffect(
                      index,
                      glassChange(effect, 'lightIntensity', fraction($event))
                    )
                  "
                  @commit="
                    effectsCtx.commitEffect(
                      index,
                      glassChange(effect, 'lightIntensity', fraction($event))
                    )
                  "
                >
                  <template #icon><icon-lucide-sun class="size-3" /></template>
                </NumberField>
              </PanelFieldGroup>
            </PanelGrid>
            <PanelGrid :columns="2">
              <PanelFieldGroup :label="panels.glassRefraction">
                <NumberField
                  suffix="%"
                  :inherit-binding="false"
                  :aria-label="panels.glassRefraction"
                  :model-value="Math.round((effect.glass ?? UNSET_GLASS).refraction * 100)"
                  :min="0"
                  :max="100"
                  data-property="glass-refraction"
                  @update:model-value="
                    effectsCtx.scrubEffect(
                      index,
                      glassChange(effect, 'refraction', fraction($event))
                    )
                  "
                  @commit="
                    effectsCtx.commitEffect(
                      index,
                      glassChange(effect, 'refraction', fraction($event))
                    )
                  "
                >
                  <template #icon><icon-lucide-waves class="size-3" /></template>
                </NumberField>
              </PanelFieldGroup>
              <PanelFieldGroup :label="panels.glassDepth">
                <NumberField
                  :inherit-binding="false"
                  :aria-label="panels.glassDepth"
                  :model-value="(effect.glass ?? UNSET_GLASS).depth"
                  :min="1"
                  :max="100"
                  data-property="glass-depth"
                  @update:model-value="
                    effectsCtx.scrubEffect(index, glassChange(effect, 'depth', $event))
                  "
                  @commit="effectsCtx.commitEffect(index, glassChange(effect, 'depth', $event))"
                >
                  <template #icon><icon-lucide-arrow-down-to-line class="size-3" /></template>
                </NumberField>
              </PanelFieldGroup>
            </PanelGrid>
            <PanelGrid :columns="2">
              <PanelFieldGroup :label="panels.glassDispersion">
                <NumberField
                  suffix="%"
                  :inherit-binding="false"
                  :aria-label="panels.glassDispersion"
                  :model-value="Math.round((effect.glass ?? UNSET_GLASS).dispersion * 100)"
                  :min="0"
                  :max="100"
                  data-property="glass-dispersion"
                  @update:model-value="
                    effectsCtx.scrubEffect(
                      index,
                      glassChange(effect, 'dispersion', fraction($event))
                    )
                  "
                  @commit="
                    effectsCtx.commitEffect(
                      index,
                      glassChange(effect, 'dispersion', fraction($event))
                    )
                  "
                >
                  <template #icon><icon-lucide-rainbow class="size-3" /></template>
                </NumberField>
              </PanelFieldGroup>
              <PanelFieldGroup :label="panels.glassFrost">
                <VariableNumberField
                  :aria-label="panels.glassFrost"
                  :model-value="effect.radius"
                  :min="0"
                  :node-id="selectedNodeIds[0] ?? ''"
                  :node-ids="selectedNodeIds"
                  :binding-path="`effects/${index}/radius`"
                  data-property="glass-frost"
                  @update:model-value="effectsCtx.scrubEffect(index, { radius: $event })"
                  @commit="effectsCtx.commitEffect(index, { radius: $event })"
                >
                  <template #icon><icon-lucide-snowflake class="size-3" /></template>
                </VariableNumberField>
              </PanelFieldGroup>
            </PanelGrid>
          </template>

          <PanelGrid v-else :columns="2">
            <PanelFieldGroup :label="panels.blur">
              <VariableNumberField
                :aria-label="panels.blur"
                :model-value="effect.radius"
                :min="0"
                :node-id="selectedNodeIds[0] ?? ''"
                :node-ids="selectedNodeIds"
                :binding-path="`effects/${index}/radius`"
                @update:model-value="effectsCtx.scrubEffect(index, { radius: $event })"
                @commit="effectsCtx.commitEffect(index, { radius: $event })"
              >
                <template #icon><icon-lucide-droplet class="size-3" /></template>
              </VariableNumberField>
            </PanelFieldGroup>
          </PanelGrid>
        </div>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
