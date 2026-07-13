<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'
import PropertyListRoot from '@/components/properties/PropertyListRoot.vue'
import { vTestId, useEffectsControls, useI18n } from '@open-pencil/vue'

import { colorToCSS } from '@open-pencil/core/color'

import type { Effect } from '@open-pencil/scene-graph'

const effectsCtx = useEffectsControls()
const { panels } = useI18n()
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <PanelSection :label="panels.effects" data-test-id="effects-section">
      <template #actions>
        <IconButton
          :label="panels.addEffect"
          data-test-id="effects-section-add"
          @click="actions.add(effectsCtx.createDefaultEffect())"
        >
          <icon-lucide-plus class="size-3.5" />
        </IconButton>
      </template>

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedEffectsHelp }}</p>

      <div
        v-for="(effect, i) in items"
        :key="`${i}:${effect.visible ? 'visible' : 'hidden'}`"
        data-test-id="effect-item"
        :data-test-index="i"
      >
        <div class="group flex items-center gap-1.5 py-0.5">
          <Tip
            :label="
              effectsCtx.expandedIndex.value === i
                ? panels.collapseEffectSettings
                : panels.expandEffectSettings
            "
          >
            <button
              v-if="effectsCtx.isShadow(effect.type)"
              class="size-5 shrink-0 cursor-pointer rounded border border-border"
              :style="{ background: colorToCSS(effect.color) }"
              @click="effectsCtx.toggleExpand(i)"
            />
            <button
              v-else
              class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input"
              @click="effectsCtx.toggleExpand(i)"
            >
              <icon-lucide-blend class="size-3 text-muted" />
            </button>
          </Tip>

          <AppSelect
            :model-value="effect.type"
            :options="effectsCtx.effectOptions"
            @update:model-value="
              effectsCtx.updateType(actions.patch, activeNode, i, $event as Effect['type'])
            "
          />

          <Tip :label="panels.toggleVisibility">
            <button
              v-test-id="`effect-visibility-${i}`"
              :data-visible="effect.visible ? 'true' : 'false'"
              class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
              @click="actions.toggleVisibility(i)"
            >
              <icon-lucide-eye
                v-if="effect.visible"
                data-test-id="visibility-icon-on"
                class="size-3.5"
              />
              <icon-lucide-eye-off v-else data-test-id="visibility-icon-off" class="size-3.5" />
            </button>
          </Tip>
          <IconButton
            :label="panels.removeEffect"
            @click="effectsCtx.handleRemove(actions.remove, i)"
          >
            <icon-lucide-minus class="size-3.5" />
          </IconButton>
        </div>

        <div class="flex flex-col gap-1.5 py-1.5">
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <Tip :label="panels.xAxis">
                <NumberField
                  icon="X"
                  :model-value="effect.offset.x"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, i, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, i, {
                      offset: { ...effect.offset, x: $event }
                    })
                  "
                />
              </Tip>
              <Tip :label="panels.yAxis">
                <NumberField
                  icon="Y"
                  :model-value="effect.offset.y"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, i, {
                      offset: { ...effect.offset, y: $event }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, i, {
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
                  @update:model-value="effectsCtx.scrubEffect(activeNode, i, { radius: $event })"
                  @commit="effectsCtx.commitEffect(activeNode, i, { radius: $event })"
                />
              </Tip>
              <Tip :label="panels.spread">
                <NumberField
                  icon="S"
                  :model-value="effect.spread"
                  @update:model-value="effectsCtx.scrubEffect(activeNode, i, { spread: $event })"
                  @commit="effectsCtx.commitEffect(activeNode, i, { spread: $event })"
                />
              </Tip>
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput
                :color="effect.color"
                editable
                @update="effectsCtx.updateColor(actions.patch, i, $event)"
              />
              <Tip :label="panels.opacity">
                <NumberField
                  class="w-14"
                  suffix="%"
                  :model-value="Math.round(effect.color.a * 100)"
                  :min="0"
                  :max="100"
                  @update:model-value="
                    effectsCtx.scrubEffect(activeNode, i, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                  @commit="
                    effectsCtx.commitEffect(activeNode, i, {
                      color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                    })
                  "
                />
              </Tip>
            </div>
          </template>

          <template v-else>
            <NumberField
              class="w-24 flex-none"
              icon="B"
              :model-value="effect.radius"
              :min="0"
              @update:model-value="effectsCtx.scrubEffect(activeNode, i, { radius: $event })"
              @commit="effectsCtx.commitEffect(activeNode, i, { radius: $event })"
            />
          </template>
        </div>
      </div>
    </PanelSection>
  </PropertyListRoot>
</template>
