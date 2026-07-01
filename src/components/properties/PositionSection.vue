<script setup lang="ts">
import ScrubInput from '@/components/ScrubInput.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelRow from '@/components/ui/PanelRow.vue'
import PanelSection from '@/components/ui/PanelSection.vue'
import Tip from '@/components/ui/Tip.vue'
import { useEditorStore } from '@/app/editor/active-store'
import { PositionControlsRoot, useI18n } from '@open-pencil/vue'

const { panels } = useI18n()
const store = useEditorStore()

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
    v-slot="{ active, isMulti, xValue, yValue, wValue, hValue, rotationValue, actions }"
  >
    <PanelSection v-if="active" :label="panels.position" data-test-id="position-section">
      <PanelRow class="mb-1.5 gap-2">
        <PanelRow gap="sm">
          <IconButton
            :label="panels.alignLeft"
            size="md"
            data-test-id="position-align-left"
            @click="handleAlign(actions.align, 'horizontal', 'min')"
          >
            <icon-lucide-align-start-vertical class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignCenterHorizontally"
            size="md"
            data-test-id="position-align-center-h"
            @click="handleAlign(actions.align, 'horizontal', 'center')"
          >
            <icon-lucide-align-center-vertical class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignRight"
            size="md"
            data-test-id="position-align-right"
            @click="handleAlign(actions.align, 'horizontal', 'max')"
          >
            <icon-lucide-align-end-vertical class="size-3.5" />
          </IconButton>
        </PanelRow>
        <PanelRow gap="sm">
          <IconButton
            :label="panels.alignTop"
            size="md"
            data-test-id="position-align-top"
            @click="handleAlign(actions.align, 'vertical', 'min')"
          >
            <icon-lucide-align-start-horizontal class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignCenterVertically"
            size="md"
            data-test-id="position-align-center-v"
            @click="handleAlign(actions.align, 'vertical', 'center')"
          >
            <icon-lucide-align-center-horizontal class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.alignBottom"
            size="md"
            data-test-id="position-align-bottom"
            @click="handleAlign(actions.align, 'vertical', 'max')"
          >
            <icon-lucide-align-end-horizontal class="size-3.5" />
          </IconButton>
        </PanelRow>
      </PanelRow>

      <PanelRow cols="two">
        <Tip :label="panels.xAxis">
          <ScrubInput
            icon="X"
            :model-value="xValue"
            @update:model-value="actions.updateProp('x', $event)"
            @commit="(v: number, p: number) => actions.commitProp('x', v, p)"
          />
        </Tip>
        <Tip :label="panels.yAxis">
          <ScrubInput
            icon="Y"
            :model-value="yValue"
            @update:model-value="actions.updateProp('y', $event)"
            @commit="(v: number, p: number) => actions.commitProp('y', v, p)"
          />
        </Tip>
      </PanelRow>

      <PanelRow v-if="isMulti" cols="two" class="mt-1.5">
        <Tip :label="panels.width">
          <ScrubInput
            icon="W"
            :model-value="wValue"
            :min="1"
            @update:model-value="actions.updateProp('width', $event)"
            @commit="(v: number, p: number) => actions.commitProp('width', v, p)"
          />
        </Tip>
        <Tip :label="panels.height">
          <ScrubInput
            icon="H"
            :model-value="hValue"
            :min="1"
            @update:model-value="actions.updateProp('height', $event)"
            @commit="(v: number, p: number) => actions.commitProp('height', v, p)"
          />
        </Tip>
      </PanelRow>

      <PanelRow cols="fill" class="mt-1.5">
        <Tip :label="panels.rotation">
          <ScrubInput
            class="flex-1"
            suffix="°"
            :model-value="rotationValue"
            :min="-360"
            :max="360"
            @update:model-value="actions.updateProp('rotation', $event)"
            @commit="(v: number, p: number) => actions.commitProp('rotation', v, p)"
          >
            <template #icon>
              <icon-lucide-rotate-cw class="size-3" />
            </template>
          </ScrubInput>
        </Tip>
        <IconButton
          :label="panels.flipHorizontal"
          size="md"
          class="shrink-0"
          data-test-id="position-flip-horizontal"
          @click="actions.flip('horizontal')"
        >
          <icon-lucide-flip-horizontal-2 class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.flipVertical"
          size="md"
          class="shrink-0"
          data-test-id="position-flip-vertical"
          @click="actions.flip('vertical')"
        >
          <icon-lucide-flip-vertical-2 class="size-3.5" />
        </IconButton>
        <IconButton
          :label="panels.rotate90"
          size="md"
          class="shrink-0"
          data-test-id="position-rotate-90"
          @click="actions.rotate(90)"
        >
          <icon-lucide-rotate-cw-square class="size-3.5" />
        </IconButton>
      </PanelRow>
    </PanelSection>
  </PositionControlsRoot>
</template>
