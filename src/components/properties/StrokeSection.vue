<script setup lang="ts">
import { ref } from 'vue'

import {
  applySolidStrokeColor,
  PropertyListRoot,
  useColorVariableBinding,
  useStrokeControls,
  useOkHCL,
  useI18n
} from '@open-pencil/vue'

import ColorStyleRow from '@/components/properties/ColorStyleRow.vue'
import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'

import type { SceneNode, Stroke } from '@open-pencil/core/scene-graph'

const strokeCtx = useStrokeControls()
const strokeVarCtx = useColorVariableBinding('strokes')
const okhcl = useOkHCL()
const { panels } = useI18n()
const sectionCls = useSectionUI()

const expandedSides = ref(false)

function onToggleSides(activeNode: SceneNode) {
  const next = !expandedSides.value
  expandedSides.value = next
  if (next && !activeNode.independentStrokeWeights) {
    const weight = activeNode.strokes[0]?.weight ?? 1
    strokeCtx.selectSide('CUSTOM', {
      ...activeNode,
      borderTopWeight: weight,
      borderRightWeight: weight,
      borderBottomWeight: weight,
      borderLeftWeight: weight
    } as SceneNode)
  } else if (!next && activeNode.independentStrokeWeights) {
    strokeCtx.selectSide('ALL', activeNode)
  }
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, add, remove, patch, toggleVisibility }"
    prop-key="strokes"
    :label="panels.stroke"
  >
    <div data-test-id="stroke-section" :class="sectionCls.wrapper">
      <div class="flex items-center justify-between">
        <label :class="sectionCls.label">{{ panels.stroke }}</label>
        <button
          data-test-id="stroke-section-add"
          :class="useIconButtonUI().base"
          @click="add(strokeCtx.defaultStroke)"
        >
          +
        </button>
      </div>

      <p v-if="isMixed" class="text-[11px] text-muted">{{ panels.mixedStrokesHelp }}</p>

      <ColorStyleRow
        v-for="(stroke, i) in items as Stroke[]"
        :key="`${i}:${stroke.visible ? 'visible' : 'hidden'}`"
        :item="stroke"
        :index="i"
        :active-node-id="activeNode?.id ?? null"
        :binding-api="strokeVarCtx"
        :visibility-test-id="`stroke-visibility-${i}`"
        unbind-test-id="stroke-unbind-variable"
        data-test-id="stroke-item"
        :data-test-index="i"
        @patch="patch(i, $event)"
        @toggle-visibility="toggleVisibility(i)"
        @remove="remove(i)"
      >
        <ColorInput
          class="min-w-0 flex-1"
          :color="stroke.color"
          :okhcl="
            activeNode
              ? {
                  fieldFormat: okhcl.getFieldFormat(activeNode, i, 'stroke'),
                  fieldOptions: okhcl.fieldOptions,
                  okhcl: okhcl.getStrokeOkHCLColor(activeNode, i),
                  ...okhcl.getStrokePreviewInfo(activeNode, i),
                  setFieldFormat: ($event) => okhcl.setStrokeFieldFormat(activeNode, i, $event),
                  updateOkHCL: ($event) => okhcl.updateStrokeOkHCL(activeNode, i, $event)
                }
              : null
          "
          editable
          @update="patch(i, applySolidStrokeColor($event))"
        />
      </ColorStyleRow>

      <div
        v-if="!isMixed && (items as unknown[]).length > 0"
        class="mt-1 flex items-center gap-1.5"
      >
        <AppSelect
          class="w-[72px]"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode!)"
        />
        <ScrubInput
          v-if="!expandedSides"
          class="flex-1"
          :model-value="activeNode!.strokes[0]?.weight ?? 1"
          :min="0"
          @update:model-value="patch(0, { weight: $event })"
        >
          <template #icon>
            <svg
              class="size-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <line x1="1" y1="3" x2="11" y2="3" />
              <line x1="1" y1="6" x2="11" y2="6" />
              <line x1="1" y1="9" x2="11" y2="9" />
            </svg>
          </template>
        </ScrubInput>
        <Tip :label="panels.strokeSides">
          <button
            data-test-id="stroke-sides-toggle"
            class="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
            :class="{ '!border-accent !text-accent': expandedSides }"
            @click="onToggleSides(activeNode!)"
          >
            <svg class="size-3.5" viewBox="0 0 14 14" fill="currentColor">
              <rect x="1" y="1" width="5" height="5" rx="1" />
              <rect x="8" y="1" width="5" height="5" rx="1" />
              <rect x="1" y="8" width="5" height="5" rx="1" />
              <rect x="8" y="8" width="5" height="5" rx="1" />
            </svg>
          </button>
        </Tip>
      </div>

      <div
        v-if="!isMixed && (items as unknown[]).length > 0 && expandedSides"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <ScrubInput
          v-for="side in strokeCtx.borderSides"
          :key="side"
          :model-value="
            activeNode![
              `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
            ] as number
          "
          :min="0"
          @update:model-value="strokeCtx.updateBorderWeight(side, $event, activeNode!)"
        >
          <template #icon>
            <svg class="size-3" viewBox="0 0 12 12" fill="none" stroke-width="1.5">
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                rx="1"
                stroke="currentColor"
                stroke-opacity="0.3"
                stroke-dasharray="2 2"
              />
              <line v-if="side === 'top'" x1="1" y1="1" x2="11" y2="1" stroke="currentColor" />
              <line
                v-else-if="side === 'right'"
                x1="11"
                y1="1"
                x2="11"
                y2="11"
                stroke="currentColor"
              />
              <line
                v-else-if="side === 'bottom'"
                x1="1"
                y1="11"
                x2="11"
                y2="11"
                stroke="currentColor"
              />
              <line v-else x1="1" y1="1" x2="1" y2="11" stroke="currentColor" />
            </svg>
          </template>
        </ScrubInput>
      </div>
    </div>
  </PropertyListRoot>
</template>
