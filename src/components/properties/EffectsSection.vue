<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'
import { PropertyListRoot, vTestId, useEffectsControls, useI18n } from '@open-pencil/vue'

import { colorToCSS } from '@open-pencil/core/color'

import type { Effect, ShadowEffect } from '@open-pencil/core/scene-graph'

const effectsCtx = useEffectsControls()
const { panels } = useI18n()
const sectionCls = useSectionUI()

/** Narrow Effect to ShadowEffect for template use inside v-if="isShadow" guards. */
function asShadow(effect: Effect): ShadowEffect {
  return effect as ShadowEffect
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, actions }"
    prop-key="effects"
    :label="panels.effects"
  >
    <div data-test-id="effects-section" :class="sectionCls.wrapper">
      <div class="flex items-center justify-between">
        <label :class="sectionCls.label">{{ panels.effects }}</label>
        <Tip :label="panels.addEffect">
          <button
            data-test-id="effects-section-add"
            :class="useIconButtonUI().base"
            @click="actions.add(effectsCtx.createDefaultEffect())"
          >
            +
          </button>
        </Tip>
      </div>

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedEffectsHelp }}</p>

      <div
        v-for="(effect, i) in items as Effect[]"
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
              :style="{ background: colorToCSS(asShadow(effect).color) }"
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
          <Tip :label="panels.removeEffect">
            <button
              :class="useIconButtonUI().base"
              @click="effectsCtx.handleRemove(actions.remove, i)"
            >
              −
            </button>
          </Tip>
        </div>

        <div class="flex flex-col gap-1.5 py-1.5">
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <ScrubInput
                icon="X"
                :model-value="asShadow(effect).offset.x"
                @update:model-value="
                  effectsCtx.scrubEffect(activeNode, i, {
                    offset: { ...asShadow(effect).offset, x: $event }
                  })
                "
                @commit="
                  effectsCtx.commitEffect(activeNode, i, {
                    offset: { ...asShadow(effect).offset, x: $event }
                  })
                "
              />
              <ScrubInput
                icon="Y"
                :model-value="asShadow(effect).offset.y"
                @update:model-value="
                  effectsCtx.scrubEffect(activeNode, i, {
                    offset: { ...asShadow(effect).offset, y: $event }
                  })
                "
                @commit="
                  effectsCtx.commitEffect(activeNode, i, {
                    offset: { ...asShadow(effect).offset, y: $event }
                  })
                "
              />
            </div>

            <div class="flex items-center gap-1.5">
              <ScrubInput
                icon="B"
                :model-value="effect.radius"
                :min="0"
                @update:model-value="effectsCtx.scrubEffect(activeNode, i, { radius: $event })"
                @commit="effectsCtx.commitEffect(activeNode, i, { radius: $event })"
              />
              <ScrubInput
                icon="S"
                :model-value="asShadow(effect).spread ?? 0"
                @update:model-value="effectsCtx.scrubEffect(activeNode, i, { spread: $event })"
                @commit="effectsCtx.commitEffect(activeNode, i, { spread: $event })"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput
                :color="asShadow(effect).color"
                editable
                @update="effectsCtx.updateColor(actions.patch, i, $event)"
              />
              <ScrubInput
                class="w-14"
                suffix="%"
                :model-value="Math.round(asShadow(effect).color.a * 100)"
                :min="0"
                :max="100"
                @update:model-value="
                  effectsCtx.scrubEffect(activeNode, i, {
                    color: { ...asShadow(effect).color, a: Math.max(0, Math.min(1, $event / 100)) }
                  })
                "
                @commit="
                  effectsCtx.commitEffect(activeNode, i, {
                    color: { ...asShadow(effect).color, a: Math.max(0, Math.min(1, $event / 100)) }
                  })
                "
              />
            </div>
          </template>

          <template v-else>
            <ScrubInput
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
    </div>
  </PropertyListRoot>
</template>
