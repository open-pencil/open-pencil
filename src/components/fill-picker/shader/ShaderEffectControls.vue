<script setup lang="ts">
import { computed } from 'vue'

import type { ShaderComponent } from '@open-pencil/scene-graph'
import { colorToHexRaw, parseColor } from '@open-pencil/scene-graph/color'
import type { Color, Vector } from '@open-pencil/scene-graph/primitives'
import { inputChecked, useI18n, type ShaderEffect, type ShaderPropControl } from '@open-pencil/vue'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

/**
 * The settings of one effect of a shader, laid out as the properties panel lays out an effect's:
 * numbers two to a row, colors as color inputs, choices as selects, generated from the props the
 * `shaders` library describes. Props it has no control for are edited in the preset's JSON.
 */
const { effect, component } = defineProps<{
  effect: ShaderEffect
  component: ShaderComponent
}>()
const emit = defineEmits<{ set: [key: string, value: unknown] }>()
const { panels } = useI18n()

/** A run of numbers, which pair up in a grid, or one other prop. */
type Block = { key: string; numbers: ShaderPropControl[] } | ShaderPropControl

/** The props in the library's order, with runs of numbers together. */
const blocks = computed(() =>
  effect.props.reduce<Block[]>((list, prop) => {
    const last = list.at(-1)
    if (prop.kind !== 'range') list.push(prop)
    else if (last && 'numbers' in last) last.numbers.push(prop)
    else list.push({ key: prop.key, numbers: [prop] })
    return list
  }, [])
)

function value(prop: ShaderPropControl): unknown {
  return component.props?.[prop.key] ?? prop.default
}

function numberValue(prop: ShaderPropControl): number {
  const current = value(prop)
  return typeof current === 'number' ? current : 0
}

function colorValue(prop: ShaderPropControl): Color {
  const current = value(prop)
  return parseColor(typeof current === 'string' ? current : '#000000')
}

/** A position as percentages of the layer, as the library's position control shows it. */
function position(prop: ShaderPropControl): Vector {
  const current = value(prop)
  if (typeof current !== 'object' || current === null) return { x: 50, y: 50 }
  const x = 'x' in current && typeof current.x === 'number' ? current.x : 0.5
  const y = 'y' in current && typeof current.y === 'number' ? current.y : 0.5
  return { x: Math.round(x * 100), y: Math.round(y * 100) }
}

function setPosition(prop: ShaderPropControl, axis: 'x' | 'y', percent: number) {
  const { x, y } = position(prop)
  emit('set', prop.key, { x: x / 100, y: y / 100, [axis]: percent / 100 })
}

function selectValue(prop: ShaderPropControl): string | number {
  const current = value(prop)
  return typeof current === 'string' || typeof current === 'number' ? current : ''
}
</script>

<template>
  <div class="flex flex-col gap-1.5" data-slot="shader-effect-settings">
    <template v-for="block in blocks" :key="block.key">
      <PanelGrid v-if="'numbers' in block" :columns="2">
        <PanelFieldGroup v-for="prop in block.numbers" :key="prop.key" :label="prop.label">
          <NumberField
            v-if="prop.kind === 'range'"
            :model-value="numberValue(prop)"
            :min="prop.min"
            :max="prop.max"
            :step="prop.step"
            :aria-label="prop.label"
            :data-property="`shader-${prop.key}`"
            @commit="emit('set', prop.key, $event)"
          />
        </PanelFieldGroup>
      </PanelGrid>
      <PanelFieldGroup v-else-if="block.kind === 'color'" :label="block.label">
        <ColorInput
          :color="colorValue(block)"
          editable
          :data-property="`shader-${block.key}`"
          @update="emit('set', block.key, `#${colorToHexRaw($event)}`)"
        />
      </PanelFieldGroup>
      <PanelFieldGroup v-else-if="block.kind === 'select'" :label="block.label">
        <AppSelect
          :model-value="selectValue(block)"
          :options="block.options"
          :label="block.label"
          :data-property="`shader-${block.key}`"
          @update:model-value="emit('set', block.key, $event)"
        />
      </PanelFieldGroup>
      <label
        v-else-if="block.kind === 'checkbox'"
        class="flex cursor-pointer items-center gap-2 text-xs text-surface"
      >
        <input
          type="checkbox"
          class="accent-accent"
          :checked="value(block) === true"
          :data-property="`shader-${block.key}`"
          @change="emit('set', block.key, inputChecked($event))"
        />
        {{ block.label }}
      </label>
      <PanelFieldGroup v-else-if="block.kind === 'position'" :label="block.label">
        <div class="flex items-center gap-1.5">
          <Tip :label="panels.xAxis">
            <NumberField
              icon="X"
              suffix="%"
              :model-value="position(block).x"
              :min="0"
              :max="100"
              @commit="setPosition(block, 'x', $event)"
            />
          </Tip>
          <Tip :label="panels.yAxis">
            <NumberField
              icon="Y"
              suffix="%"
              :model-value="position(block).y"
              :min="0"
              :max="100"
              @commit="setPosition(block, 'y', $event)"
            />
          </Tip>
        </div>
      </PanelFieldGroup>
    </template>
  </div>
</template>
