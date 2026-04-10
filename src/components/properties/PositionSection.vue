<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useIconButtonUI } from '@/components/ui/icon-button'
import { useSectionUI } from '@/components/ui/section'
import { useEditorStore } from '@/stores/editor'
import { PositionControlsRoot, useI18n } from '@open-pencil/vue'

const { panels } = useI18n()
const store = useEditorStore()
const sectionCls = useSectionUI()

function handleAlign(
  nodeAlign: (axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') => void,
  axis: 'horizontal' | 'vertical',
  pos: 'min' | 'center' | 'max'
) {
  const es = store.state.nodeEditState
  if (es && es.selectedVertexIndices.size >= 2) {
    store.nodeEditAlignVertices(axis, pos)
  } else {
    nodeAlign(axis, pos)
  }
}
</script>

<template>
  <PositionControlsRoot
    v-slot="{
      active,
      isMulti,
      xValue,
      yValue,
      wValue,
      hValue,
      rotationValue,
      updateProp,
      commitProp,
      align,
      flip,
      rotate
    }"
  >
    <div v-if="active" data-test-id="position-section" :class="sectionCls.wrapper">
      <label class="mb-1.5 block text-[11px] text-muted">{{ panels.position }}</label>

      <div class="mb-1.5 flex gap-2">
        <div class="flex gap-0.5">
          <Tip :label="panels.alignLeft">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-left"
              @click="handleAlign(align, 'horizontal', 'min')"
            >
              <icon-lucide-align-start-vertical class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.alignCenterHorizontally">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-center-h"
              @click="handleAlign(align, 'horizontal', 'center')"
            >
              <icon-lucide-align-center-vertical class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.alignRight">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-right"
              @click="handleAlign(align, 'horizontal', 'max')"
            >
              <icon-lucide-align-end-vertical class="size-3.5" />
            </button>
          </Tip>
        </div>
        <div class="flex gap-0.5">
          <Tip :label="panels.alignTop">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-top"
              @click="handleAlign(align, 'vertical', 'min')"
            >
              <icon-lucide-align-start-horizontal class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.alignCenterVertically">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-center-v"
              @click="handleAlign(align, 'vertical', 'center')"
            >
              <icon-lucide-align-center-horizontal class="size-3.5" />
            </button>
          </Tip>
          <Tip :label="panels.alignBottom">
            <button
              :class="useIconButtonUI({ size: 'md' }).base"
              tabindex="0"
              data-test-id="position-align-bottom"
              @click="handleAlign(align, 'vertical', 'max')"
            >
              <icon-lucide-align-end-horizontal class="size-3.5" />
            </button>
          </Tip>
        </div>
      </div>

      <div class="flex gap-1.5">
        <ScrubInput
          icon="X"
          :model-value="xValue"
          @update:model-value="updateProp('x', $event)"
          @commit="(v: number, p: number) => commitProp('x', v, p)"
        />
        <ScrubInput
          icon="Y"
          :model-value="yValue"
          @update:model-value="updateProp('y', $event)"
          @commit="(v: number, p: number) => commitProp('y', v, p)"
        />
      </div>

      <div v-if="isMulti" class="mt-1.5 flex gap-1.5">
        <ScrubInput
          icon="W"
          :model-value="wValue"
          :min="1"
          @update:model-value="updateProp('width', $event)"
          @commit="(v: number, p: number) => commitProp('width', v, p)"
        />
        <ScrubInput
          icon="H"
          :model-value="hValue"
          :min="1"
          @update:model-value="updateProp('height', $event)"
          @commit="(v: number, p: number) => commitProp('height', v, p)"
        />
      </div>

      <div class="mt-1.5 flex items-center gap-1.5">
        <ScrubInput
          class="flex-1"
          suffix="°"
          :model-value="rotationValue"
          :min="-360"
          :max="360"
          @update:model-value="updateProp('rotation', $event)"
          @commit="(v: number, p: number) => commitProp('rotation', v, p)"
        >
          <template #icon>
            <icon-lucide-rotate-cw class="size-3" />
          </template>
        </ScrubInput>
        <Tip :label="panels.flipHorizontal">
          <button
            :class="useIconButtonUI({ size: 'md', ui: { base: 'shrink-0' } }).base"
            tabindex="0"
            data-test-id="position-flip-horizontal"
            @click="flip('horizontal')"
          >
            <icon-lucide-flip-horizontal-2 class="size-3.5" />
          </button>
        </Tip>
        <Tip :label="panels.flipVertical">
          <button
            :class="useIconButtonUI({ size: 'md', ui: { base: 'shrink-0' } }).base"
            tabindex="0"
            data-test-id="position-flip-vertical"
            @click="flip('vertical')"
          >
            <icon-lucide-flip-vertical-2 class="size-3.5" />
          </button>
        </Tip>
        <Tip :label="panels.rotate90">
          <button
            :class="useIconButtonUI({ size: 'md', ui: { base: 'shrink-0' } }).base"
            tabindex="0"
            data-test-id="position-rotate-90"
            @click="rotate(90)"
          >
            <icon-lucide-rotate-cw-square class="size-3.5" />
          </button>
        </Tip>
      </div>
    </div>
  </PositionControlsRoot>
</template>
