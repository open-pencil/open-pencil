<script setup lang="ts">
import { useEffectsControls, useI18n } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PropertyItemRow from '@/components/properties/item-list/PropertyItemRow.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import FillSwatch from '@/components/ui/FillSwatch.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

import type { Effect, Fill } from '@open-pencil/scene-graph'

const effectsCtx = useEffectsControls()
const { panels } = useI18n()

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
    v-slot="{ items, isMixed, activeNode, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <PanelSection :label="panels.effects" :empty="!isMixed && items.length === 0">
      <template #actions>
        <IconButton
          :label="panels.addEffect"
          @click="actions.add(effectsCtx.createDefaultEffect())"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedEffectsHelp }}</p>

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
          @remove="effectsCtx.adjustExpandedAfterRemove(index)"
        >
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
        </PropertyItemRow>

        <div
          v-if="effectsCtx.expandedIndex.value === index"
          class="ml-[26px] flex flex-col gap-1.5 py-1.5"
          data-slot="effect-settings"
        >
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <Tip :label="panels.xAxis">
                <NumberField
                  icon="X"
                  :model-value="effect.offset.x"
                  data-property="effect-offset-x"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, index, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                />
              </Tip>
              <Tip :label="panels.yAxis">
                <NumberField
                  icon="Y"
                  :model-value="effect.offset.y"
                  data-property="effect-offset-y"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, index, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <Tip :label="panels.radius">
                <NumberField
                  icon="B"
                  :model-value="effect.radius"
                  :min="0"
                  data-property="effect-radius"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, index, { radius: $event })
                  "
                  @commit="effectsCtx.commitEffect(activeNode, index, { radius: $event })"
                />
              </Tip>
              <Tip :label="panels.spread">
                <NumberField
                  icon="S"
                  :model-value="effect.spread"
                  data-property="effect-spread"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, index, { spread: $event })
                  "
                  @commit="effectsCtx.commitEffect(activeNode, index, { spread: $event })"
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput
                class="min-w-0 flex-1"
                :color="effect.color"
                editable
                @update="effectsCtx.updateColor(actions.patch, index, $event)"
              />
              <Tip :label="panels.opacity">
                <NumberField
                  class="w-14"
                  suffix="%"
                  :model-value="Math.round(effect.color.a * 100)"
                  :min="0"
                  :max="100"
                  data-property="effect-opacity"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, index, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                />
              </Tip>
            </div>
          </template>

          <NumberField
            v-else
            class="w-24 flex-none"
            icon="B"
            :model-value="effect.radius"
            :min="0"
            data-property="effect-radius"
            @update:model-value="effectsCtx.scrubEffect(activeNode, index, { radius: $event })"
            @commit="effectsCtx.commitEffect(activeNode, index, { radius: $event })"
          />
        </div>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
