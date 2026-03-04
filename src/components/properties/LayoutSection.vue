<script setup lang="ts">
import { computed, ref } from 'vue'
import { onClickOutside } from '@vueuse/core'

import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'

import type { SceneNode, LayoutSizing, LayoutAlign, LayoutCounterAlign } from '@/engine/scene-graph'

const { store, node, updateProp, commitProp } = useNodeProps()

const showIndividualPadding = ref(false)
const widthSizingOpen = ref(false)
const heightSizingOpen = ref(false)
const widthDimRef = ref<HTMLElement | null>(null)
const heightDimRef = ref<HTMLElement | null>(null)

onClickOutside(widthDimRef, () => {
  widthSizingOpen.value = false
})
onClickOutside(heightDimRef, () => {
  heightSizingOpen.value = false
})

const isInAutoLayout = computed(() => {
  if (!node.value.parentId) return false
  const parent = store.graph.getNode(node.value.parentId)
  return parent ? parent.layoutMode !== 'NONE' : false
})

const widthSizing = computed(() => {
  if (node.value.layoutMode !== 'NONE') {
    return node.value.layoutMode === 'HORIZONTAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutGrow > 0) return 'FILL'
  return 'FIXED'
})

const heightSizing = computed(() => {
  if (node.value.layoutMode !== 'NONE') {
    return node.value.layoutMode === 'VERTICAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutAlignSelf === 'STRETCH') return 'FILL'
  return 'FIXED'
})

function setWidthSizing(sizing: LayoutSizing) {
  if (node.value.layoutMode !== 'NONE') {
    if (node.value.layoutMode === 'HORIZONTAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
  }
  widthSizingOpen.value = false
}

function setHeightSizing(sizing: LayoutSizing) {
  if (node.value.layoutMode !== 'NONE') {
    if (node.value.layoutMode === 'VERTICAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
  }
  heightSizingOpen.value = false
}

function sizingLabel(s: string) {
  if (s === 'HUG') return 'Hug'
  if (s === 'FILL') return 'Fill'
  return 'Fixed'
}

function hasUniformPadding() {
  return (
    node.value.paddingTop === node.value.paddingRight &&
    node.value.paddingRight === node.value.paddingBottom &&
    node.value.paddingBottom === node.value.paddingLeft
  )
}

function setUniformPadding(v: number) {
  store.updateNode(node.value.id, {
    paddingTop: v,
    paddingRight: v,
    paddingBottom: v,
    paddingLeft: v
  })
}

function commitUniformPadding(_value: number, previous: number) {
  store.commitNodeUpdate(
    node.value.id,
    {
      paddingTop: previous,
      paddingRight: previous,
      paddingBottom: previous,
      paddingLeft: previous
    } as unknown as Partial<SceneNode>,
    'Change padding'
  )
}

const ALIGN_GRID: Array<{ primary: LayoutAlign; counter: LayoutCounterAlign }> = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MAX' }
]

function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
  store.updateNodeWithUndo(
    node.value.id,
    { primaryAxisAlign: primary, counterAxisAlign: counter },
    'Change alignment'
  )
}
</script>

<template>
  <div v-if="node" data-test-id="layout-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Layout</label>
    <div class="flex gap-1.5">
      <!-- Width -->
      <div ref="widthDimRef" class="relative flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="W"
          :model-value="Math.round(node.width)"
          :min="0"
          @update:model-value="updateProp('width', $event)"
          @commit="(v: number, p: number) => commitProp('width', v, p)"
        />
        <button
          v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
          class="cursor-pointer whitespace-nowrap rounded border-none bg-transparent px-1 py-px text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="widthSizingOpen = !widthSizingOpen"
        >
          {{ sizingLabel(widthSizing) }}
        </button>
        <div
          v-if="widthSizingOpen"
          data-test-id="layout-width-sizing-dropdown"
          class="absolute top-full left-0 right-0 z-10 min-w-40 rounded-md border border-border bg-panel p-1 shadow-lg"
        >
          <button
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="widthSizing === 'FIXED' ? 'text-accent' : 'text-surface'"
            @click="setWidthSizing('FIXED')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">↔</span>Fixed width ({{
              Math.round(node.width)
            }})
          </button>
          <button
            v-if="node.layoutMode !== 'NONE'"
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="widthSizing === 'HUG' ? 'text-accent' : 'text-surface'"
            @click="setWidthSizing('HUG')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">↤↦</span>Hug contents
          </button>
          <button
            v-if="isInAutoLayout"
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="widthSizing === 'FILL' ? 'text-accent' : 'text-surface'"
            @click="setWidthSizing('FILL')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">⟷</span>Fill container
          </button>
        </div>
      </div>
      <!-- Height -->
      <div ref="heightDimRef" class="relative flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="H"
          :model-value="Math.round(node.height)"
          :min="0"
          @update:model-value="updateProp('height', $event)"
          @commit="(v: number, p: number) => commitProp('height', v, p)"
        />
        <button
          v-if="node.layoutMode !== 'NONE' || isInAutoLayout"
          class="cursor-pointer whitespace-nowrap rounded border-none bg-transparent px-1 py-px text-[10px] text-muted hover:bg-hover hover:text-surface"
          @click="heightSizingOpen = !heightSizingOpen"
        >
          {{ sizingLabel(heightSizing) }}
        </button>
        <div
          v-if="heightSizingOpen"
          data-test-id="layout-height-sizing-dropdown"
          class="absolute top-full left-0 right-0 z-10 min-w-40 rounded-md border border-border bg-panel p-1 shadow-lg"
        >
          <button
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="heightSizing === 'FIXED' ? 'text-accent' : 'text-surface'"
            @click="setHeightSizing('FIXED')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">↕</span>Fixed height ({{
              Math.round(node.height)
            }})
          </button>
          <button
            v-if="node.layoutMode !== 'NONE'"
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="heightSizing === 'HUG' ? 'text-accent' : 'text-surface'"
            @click="setHeightSizing('HUG')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">↤↦</span>Hug contents
          </button>
          <button
            v-if="isInAutoLayout"
            class="flex w-full cursor-pointer items-center gap-2 rounded border-none bg-transparent px-2 py-1.5 text-left text-xs hover:bg-hover"
            :class="heightSizing === 'FILL' ? 'text-accent' : 'text-surface'"
            @click="setHeightSizing('FILL')"
          >
            <span class="w-4 text-center text-[11px] opacity-70">⟷</span>Fill container
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Auto Layout -->
  <div v-if="node.type === 'FRAME'" class="border-b border-border px-3 py-2">
    <div class="flex items-center justify-between">
      <label class="mb-1.5 block text-[11px] text-muted">Auto layout</label>
      <button
        v-if="node.layoutMode === 'NONE'"
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-add-auto"
        title="Add auto layout (Shift+A)"
        @click="store.setLayoutMode(node.id, 'VERTICAL')"
      >
        +
      </button>
      <button
        v-else
        class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
        data-test-id="layout-remove-auto"
        title="Remove auto layout"
        @click="store.setLayoutMode(node.id, 'NONE')"
      >
        −
      </button>
    </div>

    <template v-if="node.layoutMode !== 'NONE'">
      <!-- Direction -->
      <div class="mt-1.5 flex gap-0.5">
        <button
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'VERTICAL'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-input text-muted hover:bg-hover hover:text-surface'
          "
          data-test-id="layout-direction-vertical"
          title="Vertical layout"
          @click="store.setLayoutMode(node.id, 'VERTICAL')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="3" y="2" width="10" height="3" rx="0.5" fill="currentColor" />
            <rect x="3" y="6.5" width="10" height="3" rx="0.5" fill="currentColor" />
            <rect x="3" y="11" width="10" height="3" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'HORIZONTAL'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-input text-muted hover:bg-hover hover:text-surface'
          "
          data-test-id="layout-direction-horizontal"
          title="Horizontal layout"
          @click="store.setLayoutMode(node.id, 'HORIZONTAL')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="2" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="6.5" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
            <rect x="11" y="3" width="3" height="10" rx="0.5" fill="currentColor" />
          </svg>
        </button>
        <button
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutWrap === 'WRAP'
              ? 'border-accent bg-accent text-white'
              : 'border-border bg-input text-muted hover:bg-hover hover:text-surface'
          "
          data-test-id="layout-direction-wrap"
          title="Wrap"
          @click="updateProp('layoutWrap', node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            <rect x="2" y="2" width="5" height="5" rx="0.5" fill="currentColor" />
            <rect x="9" y="2" width="5" height="5" rx="0.5" fill="currentColor" />
            <rect x="2" y="9" width="5" height="5" rx="0.5" fill="currentColor" />
          </svg>
        </button>
      </div>

      <!-- Alignment grid + Gap -->
      <div class="mt-1.5 flex items-center gap-2">
        <div
          data-test-id="layout-alignment-grid"
          class="grid grid-cols-3 gap-0.5 rounded border border-border bg-input p-1"
        >
          <button
            v-for="(a, i) in ALIGN_GRID"
            :key="i"
            class="flex size-3.5 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent p-0 hover:bg-hover"
            @click="setAlignment(a.primary, a.counter)"
          >
            <span
              class="rounded-full"
              :class="
                node.primaryAxisAlign === a.primary && node.counterAxisAlign === a.counter
                  ? 'size-1.5 bg-accent'
                  : 'size-1 bg-muted opacity-40'
              "
            />
          </button>
        </div>
        <ScrubInput
          :model-value="node.itemSpacing"
          :min="0"
          @update:model-value="updateProp('itemSpacing', $event)"
          @commit="(v: number, p: number) => commitProp('itemSpacing', v, p)"
        >
          <template #icon>
            <svg width="14" height="14" viewBox="0 0 14 14">
              <rect x="0" y="1" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.4" />
              <rect x="5" y="5" width="4" height="4" rx="0.5" fill="currentColor" />
              <rect x="10" y="1" width="4" height="12" rx="0.5" fill="currentColor" opacity="0.4" />
            </svg>
          </template>
        </ScrubInput>
      </div>

      <!-- Padding -->
      <div class="mt-1.5 flex items-start gap-1">
        <template v-if="showIndividualPadding || !hasUniformPadding()">
          <div class="grid flex-1 grid-cols-2 gap-0.5">
            <div
              v-for="side in [
                'paddingTop',
                'paddingRight',
                'paddingBottom',
                'paddingLeft'
              ] as const"
              :key="side"
            >
              <input
                type="number"
                class="w-full rounded border border-border bg-input px-1 py-0.5 text-center text-[11px] text-surface"
                :value="node[side]"
                min="0"
                @change="updateProp(side, +($event.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </template>
        <template v-else>
          <ScrubInput
            :model-value="node.paddingTop"
            :min="0"
            @update:model-value="setUniformPadding($event)"
            @commit="commitUniformPadding"
          >
            <template #icon>
              <svg width="14" height="14" viewBox="0 0 14 14">
                <rect
                  x="0"
                  y="0"
                  width="14"
                  height="14"
                  rx="2"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1"
                />
                <rect x="3" y="3" width="8" height="8" rx="1" fill="currentColor" opacity="0.3" />
              </svg>
            </template>
          </ScrubInput>
        </template>
        <button
          class="flex shrink-0 cursor-pointer items-center justify-center rounded border p-1"
          :class="
            showIndividualPadding || !hasUniformPadding()
              ? 'border-accent bg-accent text-white'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Individual padding"
          @click="showIndividualPadding = !showIndividualPadding"
        >
          <svg width="14" height="14" viewBox="0 0 14 14">
            <rect x="0" y="0" width="14" height="4" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="10" y="0" width="4" height="14" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="0" y="10" width="14" height="4" rx="1" fill="currentColor" opacity="0.6" />
            <rect x="0" y="0" width="4" height="14" rx="1" fill="currentColor" opacity="0.6" />
          </svg>
        </button>
      </div>
    </template>
  </div>

  <!-- Clip content (for all frames) -->
  <div v-if="node.type === 'FRAME'" class="border-b border-border px-3 py-2">
    <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
      <input
        type="checkbox"
        class="accent-accent"
        :checked="node.clipsContent"
        @change="
          store.updateNodeWithUndo(
            node.id,
            { clipsContent: !node.clipsContent },
            'Toggle clip content'
          )
        "
      />
      Clip content
    </label>
  </div>
</template>
