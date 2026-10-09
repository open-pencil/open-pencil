<script setup lang="ts">
import { tv } from 'tailwind-variants'

import type { Fill } from '@open-pencil/scene-graph'
import { colorToCSS } from '@open-pencil/scene-graph/color'
import {
  GradientEditorRoot,
  GradientEditorBar,
  GradientEditorStop,
  inputValue,
  useI18n
} from '@open-pencil/vue'

import ColorPickerPanel from '@/components/color-picker-panel/ColorPickerPanel.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import PaintField from '@/components/inputs/PaintField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import fillPickerTheme from '@/theme/fill-picker'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()
const activeStop = defineModel<number>('activeStop')
const { panels, editor } = useI18n()
const fillPicker = tv(fillPickerTheme)

function barStopClass(active: boolean, dragging: boolean) {
  return fillPicker({ active, dragging }).barStop()
}

function listStopClass(active: boolean) {
  return fillPicker({ active }).listStop()
}
</script>

<template>
  <GradientEditorRoot
    v-model:active-stop-index="activeStop"
    :fill="fill"
    @update="emit('update', $event)"
    v-slot="root"
  >
    <div>
      <div class="mb-2 w-28">
        <AppSelect
          :model-value="root.subtype"
          :options="root.subtypes"
          @update:model-value="root.actions.setSubtype($event)"
        />
      </div>

      <GradientEditorBar
        :stops="root.stops"
        :active-stop-index="root.activeStopIndex"
        :bar-background="root.barBackground"
        :ui="{ bar: 'relative mb-2 h-6 rounded' }"
        data-test-id="fill-picker-gradient-bar"
        @select-stop="root.actions.selectStop"
        @drag-stop="root.actions.dragStop"
        v-slot="bar"
      >
        <GradientEditorStop
          v-for="(stop, idx) in bar.stops"
          :key="idx"
          :stop="stop"
          :index="idx"
          :active="idx === bar.activeStopIndex"
          :dragging="idx === bar.draggingIndex"
          :removable="bar.stops.length > 2"
          :class="barStopClass(idx === bar.activeStopIndex, idx === bar.draggingIndex)"
          :style="{ left: `${stop.position * 100}%`, background: colorToCSS(stop.color) }"
          @select="root.actions.selectStop"
          @update-position="root.actions.updateStopPosition"
          @remove="root.actions.removeStop"
          @pointerdown.stop="bar.actions.stopPointerDown(idx, $event)"
        />
      </GradientEditorBar>

      <div class="mb-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[11px] text-muted">{{ panels.stops }}</span>
          <IconButton
            :label="panels.addStop"
            data-test-id="fill-picker-add-stop"
            @click="root.actions.addStop"
          >
            <icon-lucide-plus class="size-3" />
          </IconButton>
        </div>
        <GradientEditorStop
          v-for="(stop, idx) in root.stops"
          :key="idx"
          :stop="stop"
          :index="idx"
          :active="idx === root.activeStopIndex"
          :removable="root.stops.length > 2"
          :interactive="false"
          :class="listStopClass(idx === root.activeStopIndex)"
          @select="root.actions.selectStop"
          @update-position="root.actions.updateStopPosition"
          @update-color="root.actions.updateStopColor"
          @update-opacity="root.actions.updateStopOpacity"
          @remove="root.actions.removeStop"
          v-slot="s"
        >
          <NumberField
            class="w-14 flex-none"
            :ui="{ leading: 'hidden', field: 'pl-1.5', display: 'pl-1.5' }"
            suffix="%"
            :model-value="s.positionPercent"
            :min="0"
            :max="100"
            @update:model-value="s.actions.updatePosition(Number($event))"
            @click.stop
          />
          <PaintField
            :opacity="s.opacityPercent / 100"
            :opacity-label="panels.opacity"
            @update:opacity="s.actions.updateOpacity($event * 100)"
            @click.stop
          >
            <template #preview>
              <button
                class="size-4 shrink-0 cursor-pointer rounded border border-border p-0"
                :style="{ background: s.css }"
                @click.stop="s.actions.select"
              />
            </template>
            <template #value>
              <input
                class="min-w-0 flex-1 border-none bg-transparent font-mono text-[11px] text-surface outline-none"
                :value="s.hex"
                maxlength="6"
                @change="s.actions.updateColor(inputValue($event))"
                @click.stop
              />
            </template>
          </PaintField>
          <IconButton
            v-if="root.stops.length > 2"
            :label="editor.removeGradientStop"
            @click.stop="s.actions.remove"
          >
            <icon-lucide-minus class="size-3" />
          </IconButton>
        </GradientEditorStop>
      </div>

      <ColorPickerPanel :color="root.activeColor" @update="root.actions.updateActiveColor" />
    </div>
  </GradientEditorRoot>
</template>
