<script setup lang="ts">
import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { iconButton } from '@/components/ui/icon-button'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'
import { PropertyListRoot, useEffectsControls } from '@open-pencil/vue'

import { colorToCSS } from '@open-pencil/core'

import type { Effect } from '@open-pencil/core'

const effectsCtx = useEffectsControls()
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, patch, add, remove, toggleVisibility }"
    prop-key="effects"
    label="Effects"
  >
    <div data-test-id="effects-section" :class="sectionWrapper()">
      <div class="flex items-center justify-between">
        <label :class="sectionLabel()">Effects</label>
        <button
          data-test-id="effects-section-add"
          :class="iconButton()"
          @click="add(effectsCtx.createDefaultEffect())"
        >
          +
        </button>
      </div>

      <p v-if="isMixed" class="text-[11px] text-muted">Click + to replace mixed effects</p>

      <div
        v-for="(effect, i) in items as Effect[]"
        :key="i"
        data-test-id="effects-item"
        :data-test-index="i"
      >
        <div class="group flex items-center gap-1.5 py-0.5">
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

          <AppSelect
            :model-value="effect.type"
            :options="effectsCtx.effectOptions"
            @update:model-value="effectsCtx.updateType(patch, activeNode, i, $event as Effect['type'])"
          />

          <button
            class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
            @click="toggleVisibility(i)"
          >
            <icon-lucide-eye v-if="effect.visible" class="size-3.5" />
            <icon-lucide-eye-off v-else class="size-3.5" />
          </button>
          <button :class="iconButton()" @click="effectsCtx.handleRemove(remove, i)">−</button>
        </div>

        <div v-if="effectsCtx.expandedIndex.value === i" class="flex flex-col gap-1.5 py-1.5">
          <template v-if="effectsCtx.isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <ScrubInput
                icon="X"
                :model-value="effect.offset.x"
                @update:model-value="
                  effectsCtx.scrubEffect(activeNode, i, { offset: { ...effect.offset, x: $event } })
                "
                @commit="
                  effectsCtx.commitEffect(activeNode, i, { offset: { ...effect.offset, x: $event } })
                "
              />
              <ScrubInput
                icon="Y"
                :model-value="effect.offset.y"
                @update:model-value="
                  effectsCtx.scrubEffect(activeNode, i, { offset: { ...effect.offset, y: $event } })
                "
                @commit="
                  effectsCtx.commitEffect(activeNode, i, { offset: { ...effect.offset, y: $event } })
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
                :model-value="effect.spread"
                @update:model-value="effectsCtx.scrubEffect(activeNode, i, { spread: $event })"
                @commit="effectsCtx.commitEffect(activeNode, i, { spread: $event })"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput :color="effect.color" editable @update="effectsCtx.updateColor(patch, i, $event)" />
              <ScrubInput
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
            </div>
          </template>

          <template v-else>
            <ScrubInput
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
