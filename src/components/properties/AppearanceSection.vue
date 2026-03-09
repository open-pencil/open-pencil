<script setup lang="ts">
import { computed } from 'vue'

import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'
import { MIXED, useMultiProps } from '@/composables/use-multi-props'

import type { SceneNode } from '@open-pencil/core'

const { store, updateProp, commitProp } = useNodeProps()
const { node, nodes, isMulti, active, merged, updateAllWithUndo } = useMultiProps()

const CORNER_RADIUS_TYPES = new Set([
  'RECTANGLE',
  'ROUNDED_RECTANGLE',
  'FRAME',
  'COMPONENT',
  'INSTANCE'
])

const hasCornerRadius = computed(() => {
  if (isMulti.value) {
    return nodes.value.every((n) => CORNER_RADIUS_TYPES.has(n.type))
  }
  return node.value && CORNER_RADIUS_TYPES.has(node.value.type)
})

const visibilityState = computed(() => {
  const v = merged('visible')
  return v === MIXED ? 'mixed' : (v ? 'visible' : 'hidden')
})

function toggleVisibility() {
  if (isMulti.value) {
    const allVisible = nodes.value.every((n) => n.visible)
    updateAllWithUndo({ visible: !allVisible }, 'Toggle visibility')
  } else {
    const n = node.value
    if (!n) return
    store.updateNodeWithUndo(n.id, { visible: !n.visible }, 'Toggle visibility')
    store.requestRender()
  }
}

function toggleIndependentCorners() {
  const target = isMulti.value ? nodes.value[0] : node.value
  if (!target) return

  if (isMulti.value) {
    for (const n of nodes.value) {
      if (n.independentCorners) {
        const uniform = n.topLeftRadius
        store.updateNodeWithUndo(
          n.id,
          {
            independentCorners: false,
            cornerRadius: uniform,
            topLeftRadius: uniform,
            topRightRadius: uniform,
            bottomRightRadius: uniform,
            bottomLeftRadius: uniform
          } as Partial<SceneNode>,
          'Uniform corner radius'
        )
      } else {
        store.updateNodeWithUndo(
          n.id,
          {
            independentCorners: true,
            topLeftRadius: n.cornerRadius,
            topRightRadius: n.cornerRadius,
            bottomRightRadius: n.cornerRadius,
            bottomLeftRadius: n.cornerRadius
          } as Partial<SceneNode>,
          'Independent corner radii'
        )
      }
    }
    store.requestRender()
  } else {
    const n = node.value
    if (!n) return
    if (n.independentCorners) {
      const uniform = n.topLeftRadius
      store.updateNodeWithUndo(
        n.id,
        {
          independentCorners: false,
          cornerRadius: uniform,
          topLeftRadius: uniform,
          topRightRadius: uniform,
          bottomRightRadius: uniform,
          bottomLeftRadius: uniform
        } as Partial<SceneNode>,
        'Uniform corner radius'
      )
    } else {
      store.updateNodeWithUndo(
        n.id,
        {
          independentCorners: true,
          topLeftRadius: n.cornerRadius,
          topRightRadius: n.cornerRadius,
          bottomRightRadius: n.cornerRadius,
          bottomLeftRadius: n.cornerRadius
        } as Partial<SceneNode>,
        'Independent corner radii'
      )
    }
  }
}

function updateCornerProp(key: string, value: number) {
  if (isMulti.value) {
    for (const n of nodes.value) store.updateNode(n.id, { [key]: value })
  } else {
    const n = node.value
    if (n) store.updateNode(n.id, { [key]: value })
  }
}

function commitCornerProp(key: string, value: number, previous: number) {
  if (isMulti.value) {
    for (const n of nodes.value) {
      store.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
    }
  } else {
    const n = node.value
    if (n) store.commitNodeUpdate(n.id, { [key]: previous } as Partial<SceneNode>, `Change ${key}`)
  }
}

const independentCorners = computed(() => {
  if (isMulti.value) return merged('independentCorners')
  return node.value?.independentCorners ?? false
})

const opacityValue = computed(() => {
  const v = merged('opacity')
  return v === MIXED ? MIXED : Math.round((v as number) * 100)
})

const cornerRadiusValue = computed(() => {
  if (isMulti.value) return merged('cornerRadius')
  return node.value?.cornerRadius ?? 0
})
</script>

<template>
  <div v-if="active" data-test-id="appearance-section" class="border-b border-border px-3 py-2">
    <div class="mb-1.5 flex items-center justify-between">
      <label class="text-[11px] text-muted">Appearance</label>
      <button
        data-test-id="appearance-visibility"
        class="flex cursor-pointer items-center justify-center rounded border-none bg-transparent p-0.5 text-muted hover:bg-hover hover:text-surface"
        :class="{ 'text-accent': visibilityState === 'hidden' }"
        title="Toggle visibility"
        @click="toggleVisibility"
      >
        <icon-lucide-eye v-if="visibilityState === 'visible'" class="size-3.5" />
        <icon-lucide-eye-off v-else-if="visibilityState === 'hidden'" class="size-3.5" />
        <icon-lucide-eye class="size-3.5 opacity-50" v-else />
      </button>
    </div>
    <div class="flex gap-1.5">
      <ScrubInput
        suffix="%"
        :model-value="opacityValue"
        :min="0"
        :max="100"
        @update:model-value="updateProp('opacity', $event / 100)"
        @commit="(v: number, p: number) => commitProp('opacity', v / 100, p / 100)"
      >
        <template #icon>
          <icon-lucide-blend class="size-3" />
        </template>
      </ScrubInput>
      <template v-if="hasCornerRadius">
        <ScrubInput
          v-if="independentCorners !== true"
          data-test-id="corner-radius-input"
          :model-value="cornerRadiusValue"
          :min="0"
          @update:model-value="updateProp('cornerRadius', $event)"
          @commit="(v: number, p: number) => commitProp('cornerRadius', v, p)"
        >
          <template #icon>
            <icon-lucide-radius class="size-3" />
          </template>
        </ScrubInput>
        <button
          data-test-id="independent-corners-toggle"
          class="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
          :class="{ '!border-accent !text-accent': independentCorners === true }"
          title="Independent corner radii"
          @click="toggleIndependentCorners"
        >
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M1 4V2.5A1.5 1.5 0 0 1 2.5 1H4" />
            <path d="M8 1h1.5A2.5 2.5 0 0 1 11 3.5V5" />
            <path d="M11 8v1a2 2 0 0 1-2 2H8" />
            <path d="M4 11H3a2 2 0 0 1-2-2V8" />
          </svg>
        </button>
      </template>
    </div>

    <div
      v-if="hasCornerRadius && independentCorners === true && !isMulti"
      class="mt-1.5 grid grid-cols-2 gap-1.5"
    >
      <ScrubInput
        data-test-id="corner-tl-input"
        :model-value="node!.topLeftRadius"
        :min="0"
        @update:model-value="updateCornerProp('topLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topLeftRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M1 11V4a3 3 0 0 1 3-3h7" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-tr-input"
        :model-value="node!.topRightRadius"
        :min="0"
        @update:model-value="updateCornerProp('topRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('topRightRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M11 11V4a3 3 0 0 0-3-3H1" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-bl-input"
        :model-value="node!.bottomLeftRadius"
        :min="0"
        @update:model-value="updateCornerProp('bottomLeftRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomLeftRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M1 1v7a3 3 0 0 0 3 3h7" />
          </svg>
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="corner-br-input"
        :model-value="node!.bottomRightRadius"
        :min="0"
        @update:model-value="updateCornerProp('bottomRightRadius', $event)"
        @commit="(v: number, p: number) => commitCornerProp('bottomRightRadius', v, p)"
      >
        <template #icon>
          <svg
            class="size-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path d="M11 1v7a3 3 0 0 1-3 3H1" />
          </svg>
        </template>
      </ScrubInput>
    </div>
  </div>
</template>
