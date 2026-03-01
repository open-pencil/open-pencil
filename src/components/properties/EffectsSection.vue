<script setup lang="ts">
import { ref } from 'vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'

import type { Color, Effect } from '@/engine/scene-graph'

const { store, node } = useNodeProps()

const expandedIndex = ref<number | null>(null)

type EffectType = Effect['type']

const EFFECT_LABELS: Record<string, string> = {
  DROP_SHADOW: 'Drop shadow',
  INNER_SHADOW: 'Inner shadow',
  LAYER_BLUR: 'Layer blur',
  BACKGROUND_BLUR: 'Background blur',
  FOREGROUND_BLUR: 'Foreground blur'
}

const EFFECT_TYPES = Object.keys(EFFECT_LABELS) as EffectType[]

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

function updateEffect(index: number, changes: Partial<Effect>) {
  const n = node.value
  if (!n) return
  const effects = [...n.effects]
  effects[index] = { ...effects[index], ...changes }
  store.updateNodeWithUndo(n.id, { effects }, 'Change effect')
}

function updateColor(index: number, color: Color) {
  updateEffect(index, { color })
}

function updateColorOpacity(index: number, opacity: number) {
  const n = node.value
  if (!n) return
  const existing = n.effects[index]
  updateColor(index, { ...existing.color, a: Math.max(0, Math.min(1, opacity / 100)) })
}

function toggleVisibility(index: number) {
  const n = node.value
  if (!n) return
  updateEffect(index, { visible: !n.effects[index].visible })
}

function updateType(index: number, type: EffectType) {
  const n = node.value
  if (!n) return
  const changes: Partial<Effect> = { type }
  if (!isShadow(type)) {
    changes.offset = { x: 0, y: 0 }
    changes.spread = 0
  } else if (!isShadow(n.effects[index].type)) {
    changes.offset = { x: 0, y: 4 }
    changes.spread = 0
  }
  updateEffect(index, changes)
}

function add() {
  const n = node.value
  if (!n) return
  const effects = [...n.effects, defaultEffect()]
  store.updateNodeWithUndo(n.id, { effects }, 'Add effect')
}

function remove(index: number) {
  const n = node.value
  if (!n) return
  store.updateNodeWithUndo(
    n.id,
    { effects: n.effects.filter((_, i) => i !== index) },
    'Remove effect'
  )
  if (expandedIndex.value === index) expandedIndex.value = null
  else if (expandedIndex.value !== null && expandedIndex.value > index) expandedIndex.value--
}

function toggleExpand(index: number) {
  expandedIndex.value = expandedIndex.value === index ? null : index
}
</script>

<template>
  <div v-if="node" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1 block text-[11px] text-muted">Effects</label>
      <button
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="add"
      >
        +
      </button>
    </div>

    <div v-for="(effect, i) in node.effects" :key="i">
      <!-- Collapsed row: color swatch | type dropdown | eye | minus -->
      <div class="group flex items-center gap-1.5 py-0.5">
        <button
          v-if="isShadow(effect.type)"
          class="size-5 shrink-0 cursor-pointer rounded border border-border"
          :style="{
            background: `rgba(${Math.round(effect.color.r * 255)}, ${Math.round(effect.color.g * 255)}, ${Math.round(effect.color.b * 255)}, ${effect.color.a})`
          }"
          @click="toggleExpand(i)"
        />
        <button
          v-else
          class="flex size-5 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input"
          @click="toggleExpand(i)"
        >
          <icon-lucide-blend class="size-3 text-muted" />
        </button>

        <select
          class="min-w-0 flex-1 cursor-pointer appearance-none border-none bg-transparent text-xs text-surface outline-none"
          :value="effect.type"
          @change="updateType(i, ($event.target as HTMLSelectElement).value as EffectType)"
        >
          <option v-for="t in EFFECT_TYPES" :key="t" :value="t" class="bg-panel text-surface">
            {{ EFFECT_LABELS[t] }}
          </option>
        </select>

        <button
          class="cursor-pointer border-none bg-transparent p-0 text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-surface"
          @click="toggleVisibility(i)"
        >
          <icon-lucide-eye v-if="effect.visible" class="size-3.5" />
          <icon-lucide-eye-off v-else class="size-3.5" />
        </button>
        <button
          class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
          @click="remove(i)"
        >
          −
        </button>
      </div>

      <!-- Expanded controls inline -->
      <div v-if="expandedIndex === i" class="flex flex-col gap-1.5 py-1.5">
        <template v-if="isShadow(effect.type)">
          <div class="flex items-center gap-1.5">
            <ScrubInput
              icon="X"
              :model-value="effect.offset.x"
              @update:model-value="updateEffect(i, { offset: { ...effect.offset, x: $event } })"
            />
            <ScrubInput
              icon="Y"
              :model-value="effect.offset.y"
              @update:model-value="updateEffect(i, { offset: { ...effect.offset, y: $event } })"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <ScrubInput
              icon="B"
              :model-value="effect.radius"
              :min="0"
              @update:model-value="updateEffect(i, { radius: $event })"
            />
            <ScrubInput
              icon="S"
              :model-value="effect.spread"
              @update:model-value="updateEffect(i, { spread: $event })"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <ColorInput :color="effect.color" editable @update="updateColor(i, $event)" />
            <ScrubInput
              class="w-14"
              suffix="%"
              :model-value="Math.round(effect.color.a * 100)"
              :min="0"
              :max="100"
              @update:model-value="updateColorOpacity(i, $event)"
            />
          </div>
        </template>

        <template v-else>
          <ScrubInput
            icon="B"
            :model-value="effect.radius"
            :min="0"
            @update:model-value="updateEffect(i, { radius: $event })"
          />
        </template>
      </div>
    </div>
  </div>
</template>
