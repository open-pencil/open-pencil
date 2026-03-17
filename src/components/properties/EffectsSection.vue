<script setup lang="ts">
import { ref } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { iconButton } from '@/components/ui/icon-button'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'
import { PropertyListRoot, useEditor } from '@open-pencil/vue'

import { colorToCSS } from '@open-pencil/core'

import type { Color, Effect, SceneNode } from '@open-pencil/core'

const editor = useEditor()

const expandedIndex = ref<number | null>(null)
const effectsBeforeScrub = ref<Effect[] | null>(null)

type EffectType = Effect['type']

const EFFECT_LABELS: Record<string, string> = {
  DROP_SHADOW: 'Drop shadow',
  INNER_SHADOW: 'Inner shadow',
  LAYER_BLUR: 'Layer blur',
  BACKGROUND_BLUR: 'Background blur',
  FOREGROUND_BLUR: 'Foreground blur'
}

const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[]
const EFFECT_OPTIONS = EFFECT_TYPES.map((t) => ({ value: t, label: EFFECT_LABELS[t] }))

function isShadow(type: string) {
  return type === 'DROP_SHADOW' || type === 'INNER_SHADOW'
}

function defaultEffect(): Effect {
  return {
    type: 'DROP_SHADOW',
    color: { r: 0, g: 0, b: 0, a: 0.25 },
    offset: { x: 0, y: 4 },
    radius: 4,
    spread: 0,
    visible: true
  }
}

function scrubEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
  if (!node) return
  if (!effectsBeforeScrub.value) {
    effectsBeforeScrub.value = node.effects.map((e) => ({
      ...e,
      color: { ...e.color },
      offset: { ...e.offset }
    }))
  }
  const effects = [...node.effects]
  effects[index] = { ...effects[index], ...changes }
  editor.updateNode(node.id, { effects })
  editor.requestRender()
}

function commitEffect(node: SceneNode | null, index: number, changes: Partial<Effect>) {
  if (!node) return
  const previous = effectsBeforeScrub.value
  effectsBeforeScrub.value = null
  const effects = [...node.effects]
  effects[index] = { ...effects[index], ...changes }
  editor.updateNode(node.id, { effects })
  editor.requestRender()
  if (previous) {
    editor.commitNodeUpdate(node.id, { effects: previous }, 'Change effect')
  }
}

function updateType(
  patch: (index: number, changes: Partial<Effect>) => void,
  node: SceneNode | null,
  index: number,
  type: EffectType
) {
  if (!node) return
  const changes: Partial<Effect> = { type }
  if (!isShadow(type)) {
    changes.offset = { x: 0, y: 0 }
    changes.spread = 0
  } else if (!isShadow(node.effects[index].type)) {
    changes.offset = { x: 0, y: 4 }
    changes.spread = 0
  }
  patch(index, changes)
}

function updateColor(
  patch: (index: number, changes: Partial<Effect>) => void,
  index: number,
  color: Color
) {
  patch(index, { color })
}

function handleRemove(removeFn: (index: number) => void, index: number) {
  removeFn(index)
  if (expandedIndex.value === index) expandedIndex.value = null
  else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
}

function toggleExpand(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index
}
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
          @click="add(defaultEffect())"
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
        <!-- Collapsed row: color swatch | type dropdown | eye | minus -->
        <div class="group flex items-center gap-1.5 py-0.5">
          <button
            v-if="isShadow(effect.type)"
            class="size-5 shrink-0 cursor-pointer rounded border border-border"
            :style="{ background: colorToCSS(effect.color) }"
            @click="toggleExpand(i)"
          />
          <button
            v-else
            class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input"
            @click="toggleExpand(i)"
          >
            <icon-lucide-blend class="size-3 text-muted" />
          </button>

          <AppSelect
            :model-value="effect.type"
            :options="EFFECT_OPTIONS"
            @update:model-value="updateType(patch, activeNode, i, $event as EffectType)"
          />

          <button
            class="cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
            @click="toggleVisibility(i)"
          >
            <icon-lucide-eye v-if="effect.visible" class="size-3.5" />
            <icon-lucide-eye-off v-else class="size-3.5" />
          </button>
          <button :class="iconButton()" @click="handleRemove(remove, i)">−</button>
        </div>

        <!-- Expanded controls inline -->
        <div v-if="expandedIndex === i" class="flex flex-col gap-1.5 py-1.5">
          <template v-if="isShadow(effect.type)">
            <div class="flex items-center gap-1.5">
              <ScrubInput
                icon="X"
                :model-value="effect.offset.x"
                @update:model-value="
                  scrubEffect(activeNode, i, { offset: { ...effect.offset, x: $event } })
                "
                @commit="commitEffect(activeNode, i, { offset: { ...effect.offset, x: $event } })"
              />
              <ScrubInput
                icon="Y"
                :model-value="effect.offset.y"
                @update:model-value="
                  scrubEffect(activeNode, i, { offset: { ...effect.offset, y: $event } })
                "
                @commit="commitEffect(activeNode, i, { offset: { ...effect.offset, y: $event } })"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <ScrubInput
                icon="B"
                :model-value="effect.radius"
                :min="0"
                @update:model-value="scrubEffect(activeNode, i, { radius: $event })"
                @commit="commitEffect(activeNode, i, { radius: $event })"
              />
              <ScrubInput
                icon="S"
                :model-value="effect.spread"
                @update:model-value="scrubEffect(activeNode, i, { spread: $event })"
                @commit="commitEffect(activeNode, i, { spread: $event })"
              />
            </div>

            <div class="flex items-center gap-1.5">
              <ColorInput :color="effect.color" editable @update="updateColor(patch, i, $event)" />
              <ScrubInput
                class="w-14"
                suffix="%"
                :model-value="Math.round(effect.color.a * 100)"
                :min="0"
                :max="100"
                @update:model-value="
                  scrubEffect(activeNode, i, {
                    color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                  })
                "
                @commit="
                  commitEffect(activeNode, i, {
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
              @update:model-value="scrubEffect(activeNode, i, { radius: $event })"
              @commit="commitEffect(activeNode, i, { radius: $event })"
            />
          </template>
        </div>
      </div>
    </div>
  </PropertyListRoot>
</template>
