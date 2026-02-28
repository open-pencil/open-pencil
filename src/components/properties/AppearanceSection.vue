<script setup lang="ts">
import ScrubInput from '../ScrubInput.vue'
import { useNodeProps } from '../../composables/use-node-props'

import type { SceneNode } from '../../engine/scene-graph'

const { node } = defineProps<{ node: SceneNode }>()
const { store, updateProp, commitProp } = useNodeProps()

function toggleVisibility() {
  store.updateNodeWithUndo(node.id, { visible: !node.visible }, 'Toggle visibility')
  store.requestRender()
}
</script>

<template>
  <div class="border-b border-border px-3 py-2">
    <div class="mb-1.5 flex items-center justify-between">
      <label class="text-[11px] text-muted">Appearance</label>
      <button
        class="flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-0.5 text-muted hover:bg-hover hover:text-surface"
        :class="{ 'text-accent': !node.visible }"
        title="Toggle visibility"
        @click="toggleVisibility"
      >
        <icon-lucide-eye v-if="node.visible" class="size-3.5" />
        <icon-lucide-eye-off v-else class="size-3.5" />
      </button>
    </div>
    <div class="flex gap-1.5">
      <ScrubInput
        suffix="%"
        :model-value="Math.round(node.opacity * 100)"
        :min="0"
        :max="100"
        @update:model-value="updateProp('opacity', $event / 100)"
        @commit="(v: number, p: number) => commitProp('opacity', v / 100, p / 100)"
      >
        <template #icon>
          <icon-lucide-blend class="size-3" />
        </template>
      </ScrubInput>
      <ScrubInput
        :model-value="node.cornerRadius"
        :min="0"
        @update:model-value="updateProp('cornerRadius', $event)"
        @commit="(v: number, p: number) => commitProp('cornerRadius', v, p)"
      >
        <template #icon>
          <icon-lucide-radius class="size-3" />
        </template>
      </ScrubInput>
    </div>
  </div>
</template>
