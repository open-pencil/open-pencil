<script setup lang="ts">
import { computed, onMounted } from 'vue'

import FontPicker from '@/components/FontPicker.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'
import { loadFont } from '@/engine/fonts'

const { store, node, updateProp, commitProp } = useNodeProps()

const WEIGHTS = [
  { value: 100, label: 'Thin' },
  { value: 200, label: 'ExtraLight' },
  { value: 300, label: 'Light' },
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'SemiBold' },
  { value: 700, label: 'Bold' },
  { value: 800, label: 'ExtraBold' },
  { value: 900, label: 'Black' }
]

const currentWeightLabel = computed(
  () => WEIGHTS.find((w) => w.value === node.value.fontWeight)?.label ?? 'Regular'
)

type TextAlign = 'LEFT' | 'CENTER' | 'RIGHT'

async function selectFamily(family: string) {
  await loadFont(family, currentWeightLabel.value)
  store.updateNodeWithUndo(node.value.id, { fontFamily: family }, 'Change font')
  store.requestRender()
}

async function selectWeight(weight: number) {
  const label = WEIGHTS.find((w) => w.value === weight)?.label ?? 'Regular'
  await loadFont(node.value.fontFamily, label)
  store.updateNodeWithUndo(node.value.id, { fontWeight: weight }, 'Change font weight')
  store.requestRender()
}

function setAlign(align: TextAlign) {
  store.updateNodeWithUndo(node.value.id, { textAlignHorizontal: align }, 'Change text alignment')
  store.requestRender()
}

onMounted(async () => {
  await loadFont(node.value.fontFamily, currentWeightLabel.value)
})
</script>

<template>
  <div v-if="node" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Typography</label>

    <div class="mb-1.5">
      <FontPicker :model-value="node.fontFamily" @select="selectFamily" />
    </div>

    <!-- Weight + Size -->
    <div class="mb-1.5 flex gap-1.5">
      <select
        class="min-w-0 flex-1 cursor-pointer rounded border border-border bg-input px-1.5 py-1 text-xs text-surface"
        :value="node.fontWeight"
        @change="selectWeight(+($event.target as HTMLSelectElement).value)"
      >
        <option v-for="w in WEIGHTS" :key="w.value" :value="w.value">{{ w.label }}</option>
      </select>
      <ScrubInput
        class="flex-1"
        :model-value="node.fontSize"
        :min="1"
        :max="1000"
        @update:model-value="updateProp('fontSize', $event)"
        @commit="(v: number, p: number) => commitProp('fontSize', v, p)"
      />
    </div>

    <!-- Line height + Letter spacing -->
    <div class="mb-1.5 flex gap-1.5">
      <ScrubInput
        class="flex-1"
        :model-value="node.lineHeight ?? Math.round((node.fontSize || 14) * 1.2)"
        :min="0"
        @update:model-value="updateProp('lineHeight', $event)"
        @commit="(v: number, p: number) => commitProp('lineHeight', v, p)"
      >
        <template #icon>
          <icon-lucide-baseline class="size-3" />
        </template>
      </ScrubInput>
      <ScrubInput
        class="flex-1"
        suffix="%"
        :model-value="node.letterSpacing"
        @update:model-value="updateProp('letterSpacing', $event)"
        @commit="(v: number, p: number) => commitProp('letterSpacing', v, p)"
      >
        <template #icon>
          <icon-lucide-a-large-small class="size-3" />
        </template>
      </ScrubInput>
    </div>

    <!-- Text alignment -->
    <div class="flex gap-0.5">
      <button
        v-for="align in ['LEFT', 'CENTER', 'RIGHT'] as TextAlign[]"
        :key="align"
        class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
        :class="
          node.textAlignHorizontal === align
            ? 'border-accent bg-accent text-white'
            : 'border-border bg-input text-muted hover:bg-hover hover:text-surface'
        "
        @click="setAlign(align)"
      >
        <icon-lucide-align-left v-if="align === 'LEFT'" class="size-3.5" />
        <icon-lucide-align-center v-else-if="align === 'CENTER'" class="size-3.5" />
        <icon-lucide-align-right v-else class="size-3.5" />
      </button>
    </div>
  </div>
</template>
