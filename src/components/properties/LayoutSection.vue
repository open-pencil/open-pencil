<script setup lang="ts">
import { computed, ref } from 'vue'

import AppSelect from '@/components/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import { useNodeProps } from '@/composables/use-node-props'

import type {
  SceneNode,
  LayoutSizing,
  LayoutAlign,
  LayoutCounterAlign,
  GridTrack
} from '@open-pencil/core'

const { store, node, updateProp, commitProp } = useNodeProps()

const showIndividualPadding = ref(false)

const isInAutoLayout = computed(() => {
  if (!node.value.parentId) return false
  const parent = store.graph.getNode(node.value.parentId)
  return parent ? parent.layoutMode !== 'NONE' : false
})

const isGrid = computed(() => node.value.layoutMode === 'GRID')
const isFlex = computed(
  () => node.value.layoutMode === 'HORIZONTAL' || node.value.layoutMode === 'VERTICAL'
)

const widthSizing = computed<LayoutSizing>(() => {
  if (isFlex.value) {
    return node.value.layoutMode === 'HORIZONTAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutGrow > 0) return 'FILL'
  return 'FIXED'
})

const heightSizing = computed<LayoutSizing>(() => {
  if (isFlex.value) {
    return node.value.layoutMode === 'VERTICAL'
      ? node.value.primaryAxisSizing
      : node.value.counterAxisSizing
  }
  if (isInAutoLayout.value && node.value.layoutAlignSelf === 'STRETCH') return 'FILL'
  return 'FIXED'
})

function setWidthSizing(sizing: LayoutSizing) {
  if (isFlex.value) {
    if (node.value.layoutMode === 'HORIZONTAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutGrow', sizing === 'FILL' ? 1 : 0)
  }
}

function setHeightSizing(sizing: LayoutSizing) {
  if (isFlex.value) {
    if (node.value.layoutMode === 'VERTICAL') updateProp('primaryAxisSizing', sizing)
    else updateProp('counterAxisSizing', sizing)
  } else if (isInAutoLayout.value) {
    updateProp('layoutAlignSelf', sizing === 'FILL' ? 'STRETCH' : 'AUTO')
  }
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

const widthSizingOptions = computed(() => {
  const options: { value: LayoutSizing; label: string }[] = [
    { value: 'FIXED', label: 'Fixed' }
  ]
  if (isFlex.value) options.push({ value: 'HUG', label: 'Hug' })
  if (isInAutoLayout.value || isFlex.value) options.push({ value: 'FILL', label: 'Fill' })
  return options
})

const heightSizingOptions = computed(() => {
  const options: { value: LayoutSizing; label: string }[] = [
    { value: 'FIXED', label: 'Fixed' }
  ]
  if (isFlex.value) options.push({ value: 'HUG', label: 'Hug' })
  if (isInAutoLayout.value || isFlex.value) options.push({ value: 'FILL', label: 'Fill' })
  return options
})

type AlignCell = { primary: LayoutAlign; counter: LayoutCounterAlign }

const ALIGN_HORIZONTAL: AlignCell[] = [
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

const ALIGN_VERTICAL: AlignCell[] = [
  { primary: 'MIN', counter: 'MIN' },
  { primary: 'MIN', counter: 'CENTER' },
  { primary: 'MIN', counter: 'MAX' },
  { primary: 'CENTER', counter: 'MIN' },
  { primary: 'CENTER', counter: 'CENTER' },
  { primary: 'CENTER', counter: 'MAX' },
  { primary: 'MAX', counter: 'MIN' },
  { primary: 'MAX', counter: 'CENTER' },
  { primary: 'MAX', counter: 'MAX' }
]

const alignGrid = computed(() =>
  node.value.layoutMode === 'VERTICAL' ? ALIGN_VERTICAL : ALIGN_HORIZONTAL
)

function setAlignment(primary: LayoutAlign, counter: LayoutCounterAlign) {
  store.updateNodeWithUndo(
    node.value.id,
    { primaryAxisAlign: primary, counterAxisAlign: counter },
    'Change alignment'
  )
}

// --- Grid helpers ---

const TRACK_SIZING_OPTIONS = [
  { value: 'FR' as const, label: 'Fill (fr)' },
  { value: 'FIXED' as const, label: 'Fixed (px)' },
  { value: 'AUTO' as const, label: 'Auto' }
]

function updateGridTrack(
  prop: 'gridTemplateColumns' | 'gridTemplateRows',
  index: number,
  updates: Partial<GridTrack>
) {
  const tracks = [...node.value[prop]]
  tracks[index] = { ...tracks[index], ...updates }
  store.updateNodeWithUndo(node.value.id, { [prop]: tracks }, 'Change grid track')
}

function addTrack(prop: 'gridTemplateColumns' | 'gridTemplateRows') {
  const tracks = [...node.value[prop], { sizing: 'FR' as const, value: 1 }]
  store.updateNodeWithUndo(node.value.id, { [prop]: tracks }, 'Add grid track')
}

function removeTrack(prop: 'gridTemplateColumns' | 'gridTemplateRows', index: number) {
  const tracks = node.value[prop].filter((_: GridTrack, i: number) => i !== index)
  store.updateNodeWithUndo(node.value.id, { [prop]: tracks }, 'Remove grid track')
}

function trackLabel(track: GridTrack): string {
  if (track.sizing === 'FR') return `${track.value}fr`
  if (track.sizing === 'FIXED') return `${track.value}px`
  return 'Auto'
}
</script>

<template>
  <div v-if="node" data-test-id="layout-section" class="border-b border-border px-3 py-2">
    <label class="mb-1.5 block text-[11px] text-muted">Layout</label>
    <div class="flex gap-1.5">
      <div class="flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="W"
          :model-value="Math.round(node.width)"
          :min="0"
          @update:model-value="updateProp('width', $event)"
          @commit="(v: number, p: number) => commitProp('width', v, p)"
        />
        <AppSelect
          v-if="isFlex || isInAutoLayout"
          :model-value="widthSizing"
          :options="widthSizingOptions"
          @update:model-value="setWidthSizing"
        />
      </div>

      <div class="flex min-w-0 flex-1 items-center gap-1">
        <ScrubInput
          icon="H"
          :model-value="Math.round(node.height)"
          :min="0"
          @update:model-value="updateProp('height', $event)"
          @commit="(v: number, p: number) => commitProp('height', v, p)"
        />
        <AppSelect
          v-if="isFlex || isInAutoLayout"
          :model-value="heightSizing"
          :options="heightSizingOptions"
          @update:model-value="setHeightSizing"
        />
      </div>
    </div>
  </div>

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
      <!-- Flow direction buttons -->
      <div class="mt-1.5 flex gap-0.5">
        <button
          data-test-id="layout-direction-horizontal"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'HORIZONTAL'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Horizontal layout"
          @click="store.setLayoutMode(node.id, 'HORIZONTAL')"
        >
          <icon-lucide-arrow-right class="size-3.5" />
        </button>
        <button
          data-test-id="layout-direction-vertical"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutMode === 'VERTICAL'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Vertical layout"
          @click="store.setLayoutMode(node.id, 'VERTICAL')"
        >
          <icon-lucide-arrow-down class="size-3.5" />
        </button>
        <button
          data-test-id="layout-direction-grid"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            isGrid
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Grid layout"
          @click="store.setLayoutMode(node.id, 'GRID')"
        >
          <icon-lucide-layout-grid class="size-3.5" />
        </button>
        <button
          v-if="isFlex"
          data-test-id="layout-direction-wrap"
          class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
          :class="
            node.layoutWrap === 'WRAP'
              ? 'border-accent bg-accent/10 text-accent'
              : 'border-border text-muted hover:bg-hover hover:text-surface'
          "
          title="Wrap"
          @click="updateProp('layoutWrap', node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
        >
          <icon-lucide-wrap-text class="size-3.5" />
        </button>
      </div>

      <!-- Grid-specific controls -->
      <template v-if="isGrid">
        <!-- Column tracks -->
        <div class="mt-2">
          <div class="mb-1 flex items-center justify-between">
            <label class="text-[11px] text-muted">Columns</label>
            <button
              class="cursor-pointer rounded border-none bg-transparent px-1 text-xs leading-none text-muted hover:bg-hover hover:text-surface"
              title="Add column"
              @click="addTrack('gridTemplateColumns')"
            >
              +
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <div
              v-for="(col, i) in node.gridTemplateColumns"
              :key="i"
              class="flex items-center gap-1"
            >
              <ScrubInput
                v-if="col.sizing !== 'AUTO'"
                class="flex-1"
                :icon="`C${i + 1}`"
                :model-value="col.value"
                :min="col.sizing === 'FR' ? 1 : 0"
                :step="col.sizing === 'FR' ? 1 : 1"
                :suffix="col.sizing === 'FR' ? 'fr' : 'px'"
                @update:model-value="updateGridTrack('gridTemplateColumns', i, { value: $event })"
              />
              <span v-else class="flex-1 px-1 text-xs text-muted">{{ trackLabel(col) }}</span>
              <AppSelect
                :model-value="col.sizing"
                :options="TRACK_SIZING_OPTIONS"
                @update:model-value="
                  updateGridTrack('gridTemplateColumns', i, {
                    sizing: $event,
                    value: $event === 'FR' ? 1 : $event === 'FIXED' ? 100 : 0
                  })
                "
              />
              <button
                v-if="node.gridTemplateColumns.length > 1"
                class="cursor-pointer rounded border-none bg-transparent px-0.5 text-xs text-muted hover:text-surface"
                title="Remove column"
                @click="removeTrack('gridTemplateColumns', i)"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- Row tracks -->
        <div class="mt-2">
          <div class="mb-1 flex items-center justify-between">
            <label class="text-[11px] text-muted">Rows</label>
            <button
              class="cursor-pointer rounded border-none bg-transparent px-1 text-xs leading-none text-muted hover:bg-hover hover:text-surface"
              title="Add row"
              @click="addTrack('gridTemplateRows')"
            >
              +
            </button>
          </div>
          <div class="flex flex-col gap-1">
            <div v-for="(row, i) in node.gridTemplateRows" :key="i" class="flex items-center gap-1">
              <ScrubInput
                v-if="row.sizing !== 'AUTO'"
                class="flex-1"
                :icon="`R${i + 1}`"
                :model-value="row.value"
                :min="row.sizing === 'FR' ? 1 : 0"
                :step="row.sizing === 'FR' ? 1 : 1"
                :suffix="row.sizing === 'FR' ? 'fr' : 'px'"
                @update:model-value="updateGridTrack('gridTemplateRows', i, { value: $event })"
              />
              <span v-else class="flex-1 px-1 text-xs text-muted">{{ trackLabel(row) }}</span>
              <AppSelect
                :model-value="row.sizing"
                :options="TRACK_SIZING_OPTIONS"
                @update:model-value="
                  updateGridTrack('gridTemplateRows', i, {
                    sizing: $event,
                    value: $event === 'FR' ? 1 : $event === 'FIXED' ? 100 : 0
                  })
                "
              />
              <button
                v-if="node.gridTemplateRows.length > 1"
                class="cursor-pointer rounded border-none bg-transparent px-0.5 text-xs text-muted hover:text-surface"
                title="Remove row"
                @click="removeTrack('gridTemplateRows', i)"
              >
                ×
              </button>
            </div>
          </div>
        </div>

        <!-- Grid gaps -->
        <div class="mt-2 grid grid-cols-2 gap-1.5">
          <ScrubInput
            icon="↔"
            :model-value="Math.round(node.gridColumnGap)"
            :min="0"
            @update:model-value="updateProp('gridColumnGap', $event)"
            @commit="(v: number, p: number) => commitProp('gridColumnGap', v, p)"
          />
          <ScrubInput
            icon="↕"
            :model-value="Math.round(node.gridRowGap)"
            :min="0"
            @update:model-value="updateProp('gridRowGap', $event)"
            @commit="(v: number, p: number) => commitProp('gridRowGap', v, p)"
          />
        </div>
      </template>

      <!-- Flex-specific controls -->
      <template v-if="isFlex">
        <div class="mt-2 flex items-center gap-1.5">
          <ScrubInput
            data-test-id="layout-gap-input"
            class="flex-1"
            :icon="node.layoutMode === 'VERTICAL' ? '↕' : '↔'"
            :model-value="Math.round(node.itemSpacing)"
            :min="0"
            @update:model-value="updateProp('itemSpacing', $event)"
            @commit="(v: number, p: number) => commitProp('itemSpacing', v, p)"
          />
          <button
            class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-transparent text-muted hover:bg-hover hover:text-surface"
            :title="showIndividualPadding || !hasUniformPadding() ? 'Uniform padding' : 'Per-side padding'"
            @click="showIndividualPadding = !showIndividualPadding"
          >
            <icon-lucide-minus v-if="showIndividualPadding || !hasUniformPadding()" class="size-3" />
            <icon-lucide-plus v-else class="size-3" />
          </button>
        </div>

        <div v-if="!showIndividualPadding && hasUniformPadding()" class="mt-1.5">
          <ScrubInput
            data-test-id="layout-uniform-padding-input"
            icon="☐"
            :model-value="Math.round(node.paddingTop)"
            :min="0"
            @update:model-value="setUniformPadding"
            @commit="commitUniformPadding"
          />
        </div>
      </template>

      <!-- Per-side padding -->
      <template v-if="isGrid || (isFlex && (showIndividualPadding || !hasUniformPadding()))">
        <div class="mt-1.5 grid grid-cols-2 gap-1.5">
          <ScrubInput
            icon="T"
            :model-value="Math.round(node.paddingTop)"
            :min="0"
            @update:model-value="updateProp('paddingTop', $event)"
            @commit="(v: number, p: number) => commitProp('paddingTop', v, p)"
          />
          <ScrubInput
            icon="R"
            :model-value="Math.round(node.paddingRight)"
            :min="0"
            @update:model-value="updateProp('paddingRight', $event)"
            @commit="(v: number, p: number) => commitProp('paddingRight', v, p)"
          />
          <ScrubInput
            icon="B"
            :model-value="Math.round(node.paddingBottom)"
            :min="0"
            @update:model-value="updateProp('paddingBottom', $event)"
            @commit="(v: number, p: number) => commitProp('paddingBottom', v, p)"
          />
          <ScrubInput
            icon="L"
            :model-value="Math.round(node.paddingLeft)"
            :min="0"
            @update:model-value="updateProp('paddingLeft', $event)"
            @commit="(v: number, p: number) => commitProp('paddingLeft', v, p)"
          />
        </div>
      </template>

      <!-- Alignment (flex only) -->
      <div v-if="isFlex" class="mt-2">
        <label class="mb-1 block text-[11px] text-muted">Alignment</label>
        <div data-test-id="layout-alignment-grid" class="grid w-fit grid-cols-3 gap-0.5">
          <button
            v-for="cell in alignGrid"
            :key="`${cell.primary}-${cell.counter}`"
            class="flex size-6 cursor-pointer items-center justify-center rounded border text-[11px]"
            :class="
              node.primaryAxisAlign === cell.primary && node.counterAxisAlign === cell.counter
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-border text-muted hover:bg-hover hover:text-surface'
            "
            @click="setAlignment(cell.primary, cell.counter)"
          >
            <span class="size-1.5 rounded-full bg-current" />
          </button>
        </div>
      </div>
    </template>
  </div>

  <div v-if="node.type === 'FRAME'" class="border-b border-border px-3 py-2">
    <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
      <input
        type="checkbox"
        data-test-id="clip-content-checkbox"
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
