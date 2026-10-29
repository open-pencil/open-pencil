<script setup lang="ts">
import { isEqual } from 'es-toolkit/predicate'
import { computed, ref } from 'vue'

import type { LayoutGrid, SceneNode } from '@open-pencil/scene-graph'
import { AUTO_LAYOUT_GRID_COUNT, layoutGridCount } from '@open-pencil/scene-graph/layout'
import { useEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'
import { useSceneComputed } from '@open-pencil/vue/internal/scene-computed'

import ColorInput from '@/components/ColorPicker/ColorInput.vue'
import NumberField from '@/components/inputs/NumberField.vue'
import SharedStyleField from '@/components/properties/shared-style/SharedStyleField.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelGrid from '@/components/ui/panel/PanelGrid.vue'
import PanelItemRow from '@/components/ui/panel/PanelItemRow.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const editor = useEditor()
const { panels } = useI18n()

// Every selected frame's guides, as Figma edits several frames at once: the panel lists them
// while the frames' guides match, and offers only Add, which replaces them, while they differ.
const targets = useSceneComputed(() => editor.getSelectedNodes())
const mixed = computed(() => {
  const [first, ...rest] = targets.value
  return !!first && rest.some((node) => !isEqual(node.layoutGrids, first.layoutGrids))
})
const grids = computed<LayoutGrid[]>(() =>
  mixed.value ? [] : (targets.value.at(0)?.layoutGrids ?? [])
)

// Figma lists the newest guide first.
const rows = computed(() => grids.value.map((grid, index) => ({ grid, index })).reverse())
const expanded = ref<number | null>(null)

/** The value a stretched guide's size shows: its sections fill the frame. */
const AUTO_SIZE = Symbol('auto')
/** Figma's count for a new set of columns or rows. */
const DEFAULT_COUNT = 5

type GridPattern = 'COLUMNS' | 'ROWS' | 'GRID'
type GridAlignment = NonNullable<LayoutGrid['alignment']>

const patternOptions = computed(() => [
  { value: 'GRID' as const, label: panels.value.gridGrid },
  { value: 'COLUMNS' as const, label: panels.value.gridColumns },
  { value: 'ROWS' as const, label: panels.value.gridRows }
])

function alignmentOptions(pattern: GridPattern) {
  const p = panels.value
  const [start, end] =
    pattern === 'ROWS' ? [p.gridAlignTop, p.gridAlignBottom] : [p.gridAlignLeft, p.gridAlignRight]
  return [
    { value: 'MIN' as const, label: start },
    { value: 'CENTER' as const, label: p.gridAlignCenter },
    { value: 'MAX' as const, label: end },
    { value: 'STRETCH' as const, label: p.gridAlignStretch }
  ]
}

const isAutoCount = (grid: LayoutGrid) => layoutGridCount(grid) === AUTO_LAYOUT_GRID_COUNT
const gridAlignment = (grid: LayoutGrid): GridAlignment => grid.alignment ?? grid.type ?? 'STRETCH'

/**
 * What the row's dropdown reads, as Figma's: "5 columns", "3 rows (40px)", "Grid 10px", and
 * "Columns (40px)" for as many as fit.
 */
function summary(grid: LayoutGrid): string {
  const p = panels.value
  const pattern = gridPattern(grid)
  if (pattern === 'GRID') return p.gridSummaryGrid({ size: String(grid.sectionSize ?? 10) })
  const count = String(layoutGridCount(grid))
  const counted =
    pattern === 'ROWS' ? p.gridSummaryRows({ count }) : p.gridSummaryColumns({ count })
  const text = isAutoCount(grid) ? (pattern === 'ROWS' ? p.gridRows : p.gridColumns) : counted
  return gridAlignment(grid) === 'STRETCH'
    ? text
    : p.gridSummaryFixed({ summary: text, size: String(grid.sectionSize ?? 0) })
}

/** Switches a guide's pattern, giving it the fields the new pattern needs, as Figma does. */
function changePattern(index: number, grid: LayoutGrid, pattern: GridPattern) {
  const stripes: Partial<LayoutGrid> = {
    count: layoutGridCount(grid) > 1 ? layoutGridCount(grid) : DEFAULT_COUNT,
    gutterSize: grid.gutterSize ?? 20,
    offset: grid.offset ?? 0,
    alignment: gridAlignment(grid)
  }
  patch(
    index,
    {
      pattern,
      axis: pattern === 'ROWS' ? 'Y' : 'X',
      ...(pattern === 'GRID' ? { sectionSize: grid.sectionSize || 10 } : stripes)
    },
    'Change grid pattern'
  )
}

/** A stretched guide needs a count, so one that fit as many as it could gets Figma's default. */
function changeAlignment(index: number, grid: LayoutGrid, alignment: GridAlignment) {
  const count = alignment === 'STRETCH' && isAutoCount(grid) ? { count: DEFAULT_COUNT } : {}
  patch(index, { alignment, type: alignment, ...count }, 'Change grid type')
}

function toggleExpanded(index: number) {
  expanded.value = expanded.value === index ? null : index
}

/** Figma's new guide: a 10 px grid in translucent red. */
function defaultGrid(): LayoutGrid {
  return {
    visible: true,
    color: { r: 1, g: 0, b: 0, a: 0.1 },
    pattern: 'GRID',
    alignment: 'STRETCH',
    count: DEFAULT_COUNT,
    gutterSize: 20,
    offset: 0,
    sectionSize: 10
  }
}

/** Runs one edit per selected frame, as one undo step. */
function eachTarget(label: string, edit: (node: SceneNode) => void) {
  const nodes = targets.value
  if (nodes.length > 1) editor.undo.runBatch(label, () => nodes.forEach(edit))
  else if (nodes[0]) edit(nodes[0])
}

function commit(next: LayoutGrid[], label: string) {
  eachTarget(label, (node) =>
    editor.updateNodeWithUndo(node.id, { layoutGrids: structuredClone(next) }, label)
  )
}

function add() {
  commit(mixed.value ? [defaultGrid()] : [...grids.value, defaultGrid()], 'Add layout guide')
}

function remove(index: number) {
  expanded.value = null
  commit(
    grids.value.filter((_, i) => i !== index),
    'Remove layout guide'
  )
}

function patch(index: number, changes: Partial<LayoutGrid>, label = 'Edit layout guide') {
  commit(
    grids.value.map((grid, i) => (i === index ? { ...grid, ...changes } : grid)),
    label
  )
}

type NumericGridField = 'count' | 'gutterSize' | 'sectionSize' | 'offset'

function withValue(index: number, key: NumericGridField, value: number) {
  return grids.value.map((grid, i) => (i === index ? { ...grid, [key]: value } : grid))
}

function updateNumber(index: number, key: NumericGridField, value: number) {
  const next = withValue(index, key, value)
  for (const node of targets.value)
    editor.updateNode(node.id, { layoutGrids: structuredClone(next) })
}

function commitNumber(index: number, key: NumericGridField, previous: number) {
  const before = withValue(index, key, previous)
  eachTarget('Edit layout guide', (node) =>
    editor.commitNodeUpdate(node.id, { layoutGrids: structuredClone(before) }, 'Edit layout guide')
  )
}

/** A guide's pattern; one read from a file names stripes along an axis instead. */
function gridPattern(grid: LayoutGrid): GridPattern {
  if (grid.pattern === 'GRID' || grid.pattern === 'COLUMNS' || grid.pattern === 'ROWS')
    return grid.pattern
  return grid.axis === 'Y' ? 'ROWS' : 'COLUMNS'
}
</script>

<template>
  <PanelSection :label="panels.layoutGrids" :empty="grids.length === 0">
    <SharedStyleField v-if="targets.length === 1" kind="grid" :label="panels.gridStyle" />
    <template #actions>
      <IconButton :label="panels.addLayoutGrid" @click="add">
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
    </template>

    <div v-for="{ grid, index } in rows" :key="index" data-layout-guide>
      <PanelItemRow>
        <div class="flex min-w-0 flex-1 items-center gap-1.5">
          <Tip :label="panels.gridSettings">
            <IconButton
              :label="panels.gridSettings"
              :active="expanded === index"
              :aria-expanded="expanded === index"
              data-property="layout-guide-settings"
              @click="toggleExpanded(index)"
            >
              <icon-lucide-columns-3 v-if="gridPattern(grid) === 'COLUMNS'" class="size-3.5" />
              <icon-lucide-rows-3 v-else-if="gridPattern(grid) === 'ROWS'" class="size-3.5" />
              <icon-lucide-layout-grid v-else class="size-3.5" />
            </IconButton>
          </Tip>
          <AppSelect
            class="min-w-0 flex-1"
            :model-value="gridPattern(grid)"
            :options="patternOptions"
            :display-label="summary(grid)"
            :label="panels.layoutGrids"
            data-property="layout-guide-pattern"
            @update:model-value="changePattern(index, grid, $event)"
          />
        </div>
        <template #rail>
          <IconButton
            :label="panels.toggleVisibility"
            :active="grid.visible === false"
            @click="patch(index, { visible: grid.visible === false }, 'Toggle layout guide')"
          >
            <icon-lucide-eye-off v-if="grid.visible === false" class="size-3.5" />
            <icon-lucide-eye v-else class="size-3.5" />
          </IconButton>
          <IconButton :label="panels.removeLayoutGrid" @click="remove(index)">
            <icon-lucide-minus class="size-3.5" />
          </IconButton>
        </template>
      </PanelItemRow>

      <div
        v-if="expanded === index"
        class="flex flex-col gap-1.5 py-2"
        data-slot="layout-guide-settings"
      >
        <PanelGrid v-if="gridPattern(grid) !== 'GRID'" :columns="2">
          <PanelFieldGroup :label="panels.gridCount">
            <NumberField
              :model-value="isAutoCount(grid) ? AUTO_SIZE : layoutGridCount(grid)"
              :placeholder="panels.gridAuto"
              :min="1"
              :aria-label="panels.gridCount"
              @update:model-value="updateNumber(index, 'count', $event)"
              @commit="(_value, previous) => commitNumber(index, 'count', previous)"
            >
              <template #icon><icon-lucide-hash class="size-3" /></template>
            </NumberField>
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.gridType">
            <AppSelect
              :model-value="gridAlignment(grid)"
              :options="alignmentOptions(gridPattern(grid))"
              :label="panels.gridType"
              data-property="layout-guide-type"
              @update:model-value="changeAlignment(index, grid, $event)"
            />
          </PanelFieldGroup>
          <PanelFieldGroup
            :label="gridPattern(grid) === 'ROWS' ? panels.gridHeight : panels.gridWidth"
          >
            <NumberField
              :model-value="gridAlignment(grid) === 'STRETCH' ? AUTO_SIZE : (grid.sectionSize ?? 0)"
              :placeholder="panels.gridAuto"
              :disabled="gridAlignment(grid) === 'STRETCH'"
              :min="1"
              :aria-label="gridPattern(grid) === 'ROWS' ? panels.gridHeight : panels.gridWidth"
              @update:model-value="updateNumber(index, 'sectionSize', $event)"
              @commit="(_value, previous) => commitNumber(index, 'sectionSize', previous)"
            >
              <template #icon>
                <icon-lucide-move-vertical v-if="gridPattern(grid) === 'ROWS'" class="size-3" />
                <icon-lucide-move-horizontal v-else class="size-3" />
              </template>
            </NumberField>
          </PanelFieldGroup>
          <PanelFieldGroup
            :label="gridPattern(grid) === 'ROWS' ? panels.gridOffset : panels.gridMargin"
          >
            <NumberField
              :model-value="grid.offset ?? 0"
              :aria-label="gridPattern(grid) === 'ROWS' ? panels.gridOffset : panels.gridMargin"
              @update:model-value="updateNumber(index, 'offset', $event)"
              @commit="(_value, previous) => commitNumber(index, 'offset', previous)"
            >
              <template #icon>
                <icon-lucide-arrow-down-to-line
                  v-if="gridPattern(grid) === 'ROWS'"
                  class="size-3"
                />
                <icon-lucide-arrow-right-to-line v-else class="size-3" />
              </template>
            </NumberField>
          </PanelFieldGroup>
          <PanelFieldGroup :label="panels.gridGutter">
            <NumberField
              :model-value="grid.gutterSize ?? 0"
              :min="0"
              :aria-label="panels.gridGutter"
              @update:model-value="updateNumber(index, 'gutterSize', $event)"
              @commit="(_value, previous) => commitNumber(index, 'gutterSize', previous)"
            >
              <template #icon>
                <icon-lucide-separator-horizontal
                  v-if="gridPattern(grid) === 'ROWS'"
                  class="size-3"
                />
                <icon-lucide-separator-vertical v-else class="size-3" />
              </template>
            </NumberField>
          </PanelFieldGroup>
        </PanelGrid>
        <PanelGrid v-else :columns="2">
          <PanelFieldGroup :label="panels.gridSize">
            <NumberField
              :model-value="grid.sectionSize ?? 10"
              :min="1"
              :aria-label="panels.gridSize"
              @update:model-value="updateNumber(index, 'sectionSize', $event)"
              @commit="(_value, previous) => commitNumber(index, 'sectionSize', previous)"
            >
              <template #icon><icon-lucide-layout-grid class="size-3" /></template>
            </NumberField>
          </PanelFieldGroup>
        </PanelGrid>
        <PanelFieldGroup :label="panels.gridColor">
          <div class="flex items-center gap-1.5">
            <ColorInput
              class="min-w-0 flex-1"
              :color="grid.color ?? { r: 1, g: 0, b: 0, a: 0.1 }"
              editable
              @update="
                patch(index, { color: { ...$event, a: grid.color?.a ?? 0.1 } }, 'Change grid color')
              "
            />
            <Tip :label="panels.opacity">
              <NumberField
                class="w-14"
                suffix="%"
                :model-value="Math.round((grid.color?.a ?? 0.1) * 100)"
                :min="0"
                :max="100"
                :aria-label="panels.opacity"
                @commit="
                  (value) =>
                    patch(
                      index,
                      {
                        color: {
                          ...(grid.color ?? { r: 1, g: 0, b: 0, a: 0.1 }),
                          a: Math.max(0, Math.min(1, value / 100))
                        }
                      },
                      'Change grid color'
                    )
                "
              />
            </Tip>
          </div>
        </PanelFieldGroup>
      </div>
    </div>
  </PanelSection>
</template>
