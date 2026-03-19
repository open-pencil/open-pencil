<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'
import { useMultiProps } from '@/composables/use-multi-props'

const { store, updateProp, commitProp } = useNodeProps()
const { node, nodes, isMulti, active, prop: multiProp } = useMultiProps()
const { t } = useI18n()

const xValue = computed(() =>
  isMulti.value ? multiProp('x').value : Math.round(node.value?.x ?? 0)
)
const yValue = computed(() =>
  isMulti.value ? multiProp('y').value : Math.round(node.value?.y ?? 0)
)
const wValue = multiProp('width')
const hValue = multiProp('height')
const rotationValue = computed(() =>
  isMulti.value ? multiProp('rotation').value : Math.round(node.value?.rotation ?? 0)
)

type HAlign = 'left' | 'center' | 'right'
type VAlign = 'top' | 'center' | 'bottom'

function alignHorizontal(align: HAlign) {
  const selected = nodes.value
  if (selected.length === 0) return

  let minX: number, maxX: number

  if (selected.length === 1) {
    const parent = store.graph.getNode(selected[0].parentId ?? '')
    if (!parent) return
    minX = 0
    maxX = parent.width
  } else {
    minX = Infinity
    maxX = -Infinity
    for (const n of selected) {
      const abs = store.graph.getAbsolutePosition(n.id)
      minX = Math.min(minX, abs.x)
      maxX = Math.max(maxX, abs.x + n.width)
    }
  }

  for (const n of selected) {
    let targetX: number
    if (selected.length === 1) {
      if (align === 'left') targetX = minX
      else if (align === 'right') targetX = maxX - n.width
      else targetX = (minX + maxX) / 2 - n.width / 2
      store.updateNode(n.id, { x: targetX })
    } else {
      const abs = store.graph.getAbsolutePosition(n.id)
      if (align === 'left') targetX = minX
      else if (align === 'right') targetX = maxX - n.width
      else targetX = (minX + maxX) / 2 - n.width / 2
      store.updateNode(n.id, { x: n.x + (targetX - abs.x) })
    }
  }
  store.requestRender()
}

function alignVertical(align: VAlign) {
  const selected = nodes.value
  if (selected.length === 0) return

  let minY: number, maxY: number

  if (selected.length === 1) {
    const parent = store.graph.getNode(selected[0].parentId ?? '')
    if (!parent) return
    minY = 0
    maxY = parent.height
  } else {
    minY = Infinity
    maxY = -Infinity
    for (const n of selected) {
      const abs = store.graph.getAbsolutePosition(n.id)
      minY = Math.min(minY, abs.y)
      maxY = Math.max(maxY, abs.y + n.height)
    }
  }

  for (const n of selected) {
    let targetY: number
    if (selected.length === 1) {
      if (align === 'top') targetY = minY
      else if (align === 'bottom') targetY = maxY - n.height
      else targetY = (minY + maxY) / 2 - n.height / 2
      store.updateNode(n.id, { y: targetY })
    } else {
      const abs = store.graph.getAbsolutePosition(n.id)
      if (align === 'top') targetY = minY
      else if (align === 'bottom') targetY = maxY - n.height
      else targetY = (minY + maxY) / 2 - n.height / 2
      store.updateNode(n.id, { y: n.y + (targetY - abs.y) })
    }
  }
  store.requestRender()
}

function flipHorizontal() {
  for (const n of nodes.value) {
    store.updateNodeWithUndo(n.id, { flipX: !n.flipX }, 'Flip horizontal')
  }
  store.requestRender()
}

function flipVertical() {
  for (const n of nodes.value) {
    store.updateNodeWithUndo(n.id, { flipY: !n.flipY }, 'Flip vertical')
  }
  store.requestRender()
}

function rotate90() {
  for (const n of nodes.value) {
    store.updateNodeWithUndo(n.id, { rotation: (n.rotation + 90) % 360 }, 'Rotate 90°')
  }
  store.requestRender()
}
</script>

<template>
  <div v-if="active" data-test-id="position-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">{{ t('properties.position.title') }}</label>

    <!-- Alignment buttons -->
    <div class="mb-1.5 flex gap-2">
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-left"
          :title="t('properties.position.alignLeft')"
          @click="alignHorizontal('left')"
        >
          <icon-lucide-align-horizontal-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-center-h"
          :title="t('properties.position.alignCenterH')"
          @click="alignHorizontal('center')"
        >
          <icon-lucide-align-horizontal-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-right"
          :title="t('properties.position.alignRight')"
          @click="alignHorizontal('right')"
        >
          <icon-lucide-align-horizontal-justify-end class="size-3.5" />
        </button>
      </div>
      <div class="flex gap-0.5">
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-top"
          :title="t('properties.position.alignTop')"
          @click="alignVertical('top')"
        >
          <icon-lucide-align-vertical-justify-start class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-center-v"
          :title="t('properties.position.alignCenterV')"
          @click="alignVertical('center')"
        >
          <icon-lucide-align-vertical-justify-center class="size-3.5" />
        </button>
        <button
          class="flex size-7 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          data-test-id="position-align-bottom"
          :title="t('properties.position.alignBottom')"
          @click="alignVertical('bottom')"
        >
          <icon-lucide-align-vertical-justify-end class="size-3.5" />
        </button>
      </div>
    </div>

    <!-- X / Y -->
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

    <!-- W / H (multi-select only; single-select shows in LayoutSection) -->
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

    <!-- Rotation + flip -->
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
          <icon-lucide-rotate-ccw class="size-3" />
        </template>
      </ScrubInput>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        data-test-id="position-flip-horizontal"
        title="Flip horizontal"
        @click="flipHorizontal"
      >
        <icon-lucide-flip-horizontal class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        data-test-id="position-flip-vertical"
        title="Flip vertical"
        @click="flipVertical"
      >
        <icon-lucide-flip-vertical class="size-3.5" />
      </button>
      <button
        class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
        data-test-id="position-rotate-90"
        title="Rotate 90°"
        @click="rotate90"
      >
        <icon-lucide-rotate-cw class="size-3.5" />
      </button>
    </div>
  </div>
</template>
