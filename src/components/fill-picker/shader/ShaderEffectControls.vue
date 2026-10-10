<script setup lang="ts">
import { groupBy } from 'es-toolkit'
import { computed, reactive } from 'vue'

import type { ShaderComponent } from '@open-pencil/scene-graph'
import type { Vector } from '@open-pencil/scene-graph/primitives'
import { useI18n, type ShaderEffect, type ShaderPropControl } from '@open-pencil/vue'

import NumberField from '@/components/inputs/NumberField.vue'
import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

/** Controls for one effect of a shader, generated from the props the `shaders` library describes. */
const { effect, component } = defineProps<{
  effect: ShaderEffect
  component: ShaderComponent
}>()
const emit = defineEmits<{ set: [key: string, value: unknown] }>()
const { panels } = useI18n()

const groups = computed(() => Object.entries(groupBy(effect.props, (prop) => prop.group)))

function value(prop: ShaderPropControl): unknown {
  return component.props?.[prop.key] ?? prop.default
}

function numberValue(prop: ShaderPropControl): number {
  const current = value(prop)
  return typeof current === 'number' ? current : 0
}

/** What is typed into a text or color field, committed when the field changes. */
const drafts = reactive(new Map<string, string>())

function textValue(prop: ShaderPropControl): string {
  const draft = drafts.get(prop.key)
  if (draft !== undefined) return draft
  const current = value(prop)
  return typeof current === 'string' ? current : ''
}

function commitText(prop: ShaderPropControl) {
  const draft = drafts.get(prop.key)
  drafts.delete(prop.key)
  if (draft !== undefined && draft !== value(prop)) emit('set', prop.key, draft)
}

/** A position's coordinates as percentages of the layer, as the library's position control shows them. */
function position(prop: ShaderPropControl): Vector {
  const current = value(prop)
  if (typeof current !== 'object' || current === null) return { x: 50, y: 50 }
  const x = 'x' in current && typeof current.x === 'number' ? current.x : 0.5
  const y = 'y' in current && typeof current.y === 'number' ? current.y : 0.5
  return { x: Math.round(x * 100), y: Math.round(y * 100) }
}

function setPosition(prop: ShaderPropControl, axis: 'x' | 'y', percent: number) {
  const { x, y } = position(prop)
  const next = { x: x / 100, y: y / 100, [axis]: percent / 100 }
  emit('set', prop.key, next)
}

function selectValue(prop: ShaderPropControl): string | number {
  const current = value(prop)
  return typeof current === 'string' || typeof current === 'number' ? current : ''
}
</script>

<template>
  <div class="flex flex-col gap-2" data-test-id="shader-effect-controls">
    <p v-if="effect.description" class="text-[11px] text-muted">{{ effect.description }}</p>
    <div v-for="[group, props] in groups" :key="group" class="flex flex-col gap-1.5">
      <span v-if="group" class="text-[11px] font-medium text-surface">{{ group }}</span>
      <PanelFieldGroup v-for="prop in props" :key="prop.key" :label="prop.label">
        <NumberField
          v-if="prop.kind === 'range'"
          :model-value="numberValue(prop)"
          :min="prop.min"
          :max="prop.max"
          :step="prop.step"
          :aria-label="prop.label"
          :data-shader-prop="prop.key"
          @commit="emit('set', prop.key, $event)"
        />
        <div v-else-if="prop.kind === 'color'" class="flex items-center gap-1.5">
          <span
            class="size-4 shrink-0 rounded-sm border border-border"
            :style="{ background: textValue(prop) }"
          />
          <AppInput
            :model-value="textValue(prop)"
            :aria-label="prop.label"
            :data-shader-prop="prop.key"
            size="xs"
            class="min-w-0 flex-1 font-mono"
            @update:model-value="drafts.set(prop.key, String($event))"
            @change="commitText(prop)"
          />
        </div>
        <AppSelect
          v-else-if="prop.kind === 'select'"
          :model-value="selectValue(prop)"
          :options="prop.options"
          :label="prop.label"
          :data-shader-prop="prop.key"
          @update:model-value="emit('set', prop.key, $event)"
        />
        <AppCheckbox
          v-else-if="prop.kind === 'checkbox'"
          :model-value="value(prop) === true"
          :ariaLabel="prop.label"
          :data-shader-prop="prop.key"
          @update:model-value="emit('set', prop.key, $event)"
        />
        <div v-else-if="prop.kind === 'position'" class="grid grid-cols-2 gap-1.5">
          <NumberField
            :model-value="position(prop).x"
            :min="0"
            :max="100"
            label="X"
            suffix="%"
            :aria-label="`${prop.label} X`"
            @commit="setPosition(prop, 'x', $event)"
          />
          <NumberField
            :model-value="position(prop).y"
            :min="0"
            :max="100"
            label="Y"
            suffix="%"
            :aria-label="`${prop.label} Y`"
            @commit="setPosition(prop, 'y', $event)"
          />
        </div>
        <AppInput
          v-else-if="prop.kind === 'text'"
          size="xs"
          :model-value="textValue(prop)"
          :aria-label="prop.label"
          :data-shader-prop="prop.key"
          @update:model-value="drafts.set(prop.key, String($event))"
          @change="commitText(prop)"
        />
        <span v-else class="text-[11px] text-muted">{{ panels.shaderPropInPreset }}</span>
      </PanelFieldGroup>
    </div>
  </div>
</template>
