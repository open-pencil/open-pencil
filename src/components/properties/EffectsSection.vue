<script setup lang="ts">
import { computed, ref } from 'vue'
import AppSelect from '@/components/AppSelect.vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'
import { useMultiProps } from '@/composables/use-multi-props'

import type { Color, Effect } from '@/engine/scene-graph'

const { store } = useNodeProps()
const { node, nodes, isMulti, active } = useMultiProps()

const effectsAreMixed = computed(() => {
  if (!isMulti.value) return false
  const all = nodes.value
  const first = JSON.stringify(all[0].effects)
  return all.some((n) => JSON.stringify(n.effects) !== first)
})

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

function scrubEffect(index: number, changes: Partial<Effect>) {
  const n = node.value
  if (!n) return
  if (!effectsBeforeScrub.value) {
    effectsBeforeScrub.value = n.effects.map((e) => ({
      ...e,
      color: { ...e.color },
      offset: { ...e.offset }
    }))
  }
  const effects = [...n.effects]
  effects[index] = { ...effects[index], ...changes }
  store.updateNode(n.id, { effects })
  store.requestRender()
}

function commitEffect(index: number, changes: Partial<Effect>) {
  const n = node.value
  if (!n) return
  const previous = effectsBeforeScrub.value
  effectsBeforeScrub.value = null
  const effects = [...n.effects]
  effects[index] = { ...effects[index], ...changes }
  store.updateNode(n.id, { effects })
  store.requestRender()
  if (previous) {
    store.commitNodeUpdate(n.id, { effects: previous }, 'Change effect')
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
  if (isMulti.value) {
    for (const n of nodes.value) {
      store.updateNodeWithUndo(n.id, { effects: [defaultEffect()] }, 'Set effect')
    }
    store.requestRender()
    return
  }
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
  <div v-if="active" data-test-id="effects-section" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1 block text-[11px] text-muted">Effects</label>
      <button
        data-test-id="effects-section-add"
        class="flex size-5 cursor-pointer items-center justify-center rounded border-none bg-transparent text-sm leading-none text-muted hover:bg-hover hover:text-surface"
        @click="add"
      >
        +
      </button>
    </div>

    <p v-if="effectsAreMixed" class="text-[11px] text-muted">Click + to replace mixed effects</p>

    <div
      v-for="(effect, i) in effectsAreMixed ? [] : ((node ?? nodes[0])?.effects ?? [])"
      :key="i"
      data-test-id="effects-item"
      :data-test-index="i"
    >
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

        <AppSelect
          :model-value="effect.type"
          :options="EFFECT_OPTIONS"
          @update:model-value="updateType(i, $event as EffectType)"
        />

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
              @update:model-value="scrubEffect(i, { offset: { ...effect.offset, x: $event } })"
              @commit="commitEffect(i, { offset: { ...effect.offset, x: $event } })"
            />
            <ScrubInput
              icon="Y"
              :model-value="effect.offset.y"
              @update:model-value="scrubEffect(i, { offset: { ...effect.offset, y: $event } })"
              @commit="commitEffect(i, { offset: { ...effect.offset, y: $event } })"
            />
          </div>

          <div class="flex items-center gap-1.5">
            <ScrubInput
              icon="B"
              :model-value="effect.radius"
              :min="0"
              @update:model-value="scrubEffect(i, { radius: $event })"
              @commit="commitEffect(i, { radius: $event })"
            />
            <ScrubInput
              icon="S"
              :model-value="effect.spread"
              @update:model-value="scrubEffect(i, { spread: $event })"
              @commit="commitEffect(i, { spread: $event })"
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
              @update:model-value="
                scrubEffect(i, {
                  color: { ...effect.color, a: Math.max(0, Math.min(1, $event / 100)) }
                })
              "
              @commit="
                commitEffect(i, {
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
            @update:model-value="scrubEffect(i, { radius: $event })"
            @commit="commitEffect(i, { radius: $event })"
          />
        </template>
      </div>
    </div>
  </div>
</template>
