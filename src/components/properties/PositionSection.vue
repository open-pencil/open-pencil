<script setup lang="ts">
import { PositionControlsRoot, useI18n } from '@open-pencil/vue'

import { useEditorStore } from '@/app/editor/active-store'
import NumberField from '@/components/inputs/NumberField.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'

const { panels } = useI18n()
const store = useEditorStore()

function handleAlign(
  nodeAlign: (axis: 'horizontal' | 'vertical', pos: 'min' | 'center' | 'max') => void,
  axis: 'horizontal' | 'vertical',
  pos: 'min' | 'center' | 'max'
) {
  const editState = store.state.nodeEditState
  if (editState && editState.selectedVertexIndices.size >= 2) {
    store.nodeEditAlignVertices(axis, pos)
  } else {
    nodeAlign(axis, pos)
  }
}
</script>

<template>
  <PositionControlsRoot
    v-slot="{ active, isMulti, xValue, yValue, wValue, hValue, rotationValue, actions }"
  >
    <PanelSection v-if="active" :label="panels.position">
      <div role="toolbar" :aria-label="panels.position" class="mb-1.5 flex justify-between">
        <div class="flex gap-0.5">
          <IconButton
            :label="panels.alignLeft"
            size="md"
            @click="handleAlign(actions.align, 'horizontal', 'min')"
          >
            <icon-lucide-align-start-vertical class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignCenterHorizontally"
            size="md"
            @click="handleAlign(actions.align, 'horizontal', 'center')"
          >
            <icon-lucide-align-center-vertical class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignRight"
            size="md"
            @click="handleAlign(actions.align, 'horizontal', 'max')"
          >
            <icon-lucide-align-end-vertical class="size-3.5" />
          </IconButton>
        </div>
        <div class="flex gap-0.5">
          <IconButton
            :label="panels.alignTop"
            size="md"
            @click="handleAlign(actions.align, 'vertical', 'min')"
          >
            <icon-lucide-align-start-horizontal class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignCenterVertically"
            size="md"
            @click="handleAlign(actions.align, 'vertical', 'center')"
          >
            <icon-lucide-align-center-horizontal class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignBottom"
            size="md"
            @click="handleAlign(actions.align, 'vertical', 'max')"
          >
            <icon-lucide-align-end-horizontal class="size-3.5" />
          </IconButton>
        </div>
      </div>

      <PanelGrid columns="two">
        <Tip :label="panels.xAxis">
          <NumberField
            icon="X"
            data-property="x"
            :aria-label="panels.xAxis"
            :model-value="xValue"
            @update:model-value="actions.updateProp('x', $event)"
            @commit="(v: number, p: number) => actions.commitProp('x', v, p)"
          />
        </Tip>
        <Tip :label="panels.yAxis">
          <NumberField
            icon="Y"
            data-property="y"
            :aria-label="panels.yAxis"
            :model-value="yValue"
            @update:model-value="actions.updateProp('y', $event)"
            @commit="(v: number, p: number) => actions.commitProp('y', v, p)"
          />
        </Tip>
      </PanelGrid>

      <PanelGrid v-if="isMulti" columns="two" class="mt-1.5">
        <Tip :label="panels.width">
          <NumberField
            icon="W"
            data-property="width"
            :aria-label="panels.width"
            :model-value="wValue"
            :min="1"
            @update:model-value="actions.updateProp('width', $event)"
            @commit="(v: number, p: number) => actions.commitProp('width', v, p)"
          />
        </Tip>
        <Tip :label="panels.height">
          <NumberField
            icon="H"
            data-property="height"
            :aria-label="panels.height"
            :model-value="hValue"
            :min="1"
            @update:model-value="actions.updateProp('height', $event)"
            @commit="(v: number, p: number) => actions.commitProp('height', v, p)"
          />
        </Tip>
      </PanelGrid>

      <div class="mt-1.5 grid grid-cols-[minmax(0,1fr)_repeat(3,24px)] gap-0.5">
        <Tip :label="panels.rotation">
          <NumberField
            suffix="°"
            data-property="rotation"
            :aria-label="panels.rotation"
            :model-value="rotationValue"
            :min="-360"
            :max="360"
            @update:model-value="actions.updateProp('rotation', $event)"
            @commit="(v: number, p: number) => actions.commitProp('rotation', v, p)"
          >
            <template #icon>
              <icon-lucide-rotate-cw class="size-3" />
            </template>
          </NumberField>
        </Tip>
        <IconButton :label="panels.flipHorizontal" size="md" @click="actions.flip('horizontal')">
          <icon-lucide-flip-horizontal-2 class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.flipVertical" size="md" @click="actions.flip('vertical')">
          <icon-lucide-flip-vertical-2 class="size-3.5" />
        </IconButton>
        <IconButton :label="panels.rotate90" size="md" @click="actions.rotate(90)">
          <icon-lucide-rotate-cw-square class="size-3.5" />
        </IconButton>
      </div>
    </PanelSection>
  </PositionControlsRoot>
</template>
