<script setup lang="ts">
import AppSelect from './ui/AppSelect.vue'
import Tip from './ui/Tip.vue'
import ColorPickerPanel from '@/components/ColorPickerPanel/ColorPickerPanel.vue'
import ScrubInput from './ScrubInput.vue'
import { colorToCSS } from '@open-pencil/core/color'
import {
  GradientEditorRoot,
  GradientEditorBar,
  GradientEditorStop,
  useI18n
} from '@open-pencil/vue'

import type { Fill } from '@open-pencil/core/scene-graph'

const { fill } = defineProps<{ fill: Fill }>()
const emit = defineEmits<{ update: [fill: Fill] }>()
const { panels } = useI18n()
</script>

<template>
  <GradientEditorRoot :fill="fill" @update="emit('update', $event)" v-slot="root">
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
        <div
          v-for="(stop, idx) in bar.stops"
          :key="idx"
          class="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-sm border-2 shadow-sm"
          :class="idx === bar.activeStopIndex ? 'border-white' : 'border-white/60'"
          :style="{ left: `${stop.position * 100}%`, background: colorToCSS(stop.color) }"
          @pointerdown.stop="bar.actions.stopPointerDown(idx, $event)"
        />
      </GradientEditorBar>

      <div class="mb-2">
        <div class="mb-1 flex items-center justify-between">
          <span class="text-[11px] text-muted">{{ panels.stops }}</span>
          <Tip :label="panels.addStop">
            <button
              class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
              data-test-id="fill-picker-add-stop"
              @click="root.actions.addStop"
            >
              <icon-lucide-plus class="size-3" />
            </button>
          </Tip>
        </div>
        <GradientEditorStop
          v-for="(stop, idx) in root.stops"
          :key="idx"
          :stop="stop"
          :index="idx"
          :active="idx === root.activeStopIndex"
          @select="root.actions.selectStop"
          @update-position="root.actions.updateStopPosition"
          @update-color="root.actions.updateStopColor"
          @update-opacity="root.actions.updateStopOpacity"
          @remove="root.actions.removeStop"
          v-slot="s"
        >
          <div
            class="flex items-center gap-1 py-0.5"
            :class="{ 'rounded bg-hover/50': s.active }"
            @click="s.actions.select"
          >
            <ScrubInput
              class="w-11"
              suffix="%"
              :model-value="s.positionPercent"
              :min="0"
              :max="100"
              @update:model-value="s.actions.updatePosition(Number($event))"
              @click.stop
            />
            <button
              class="size-4 shrink-0 cursor-pointer rounded border border-border p-0"
              :style="{ background: s.css }"
              @click.stop="s.actions.select"
            />
            <input
              class="min-w-0 flex-1 rounded border border-border bg-input px-1 py-0.5 font-mono text-[11px] text-surface"
              :value="s.hex"
              maxlength="6"
              @change="s.actions.updateColor(($event.target as HTMLInputElement).value)"
              @click.stop
            />
            <ScrubInput
              class="w-9"
              suffix="%"
              :model-value="s.opacityPercent"
              :min="0"
              :max="100"
              @update:model-value="s.actions.updateOpacity(Number($event))"
              @click.stop
            />
            <button
              v-if="root.stops.length > 2"
              class="flex size-4 cursor-pointer items-center justify-center rounded border-none bg-transparent p-0 text-muted hover:text-surface"
              @click.stop="s.actions.remove"
            >
              −
            </button>
          </div>
        </GradientEditorStop>
      </div>

      <ColorPickerPanel :color="root.activeColor" @update="root.actions.updateActiveColor" />
    </div>
  </GradientEditorRoot>
</template>
