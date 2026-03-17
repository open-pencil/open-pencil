<script setup lang="ts">
import { ref } from 'vue'
import {
  DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal
} from 'reka-ui'

import AppSelect from '@/components/AppSelect.vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/Tip.vue'
import { iconButton } from '@/components/ui/icon-button'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'
import { PropertyListRoot, useEditor } from '@open-pencil/vue'
import { menuContent, menuItem } from '@/components/ui/menu'

import type { SceneNode, Stroke } from '@open-pencil/core'

type StrokeSides = 'ALL' | 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'CUSTOM'

const store = useEditor()

const ALIGN_OPTIONS: { value: Stroke['align']; label: string }[] = [
  { value: 'INSIDE', label: 'Inside' },
  { value: 'CENTER', label: 'Center' },
  { value: 'OUTSIDE', label: 'Outside' }
]

const SIDE_OPTIONS: { value: StrokeSides; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'TOP', label: 'Top' },
  { value: 'BOTTOM', label: 'Bottom' },
  { value: 'LEFT', label: 'Left' },
  { value: 'RIGHT', label: 'Right' },
  { value: 'CUSTOM', label: 'Custom' }
]

const BORDER_SIDES = ['top', 'right', 'bottom', 'left'] as const

const sideMenuOpen = ref(false)

function updateAlign(align: Stroke['align'], activeNode: SceneNode) {
  const strokes = activeNode.strokes.map((s) => ({ ...s, align }))
  store.updateNodeWithUndo(activeNode.id, { strokes }, 'Change stroke align')
}

function currentAlign(activeNode: SceneNode | null): Stroke['align'] {
  if (!activeNode || activeNode.strokes.length === 0) return 'CENTER'
  return activeNode.strokes[0].align
}

function currentSides(activeNode: SceneNode | null): StrokeSides {
  if (!activeNode?.independentStrokeWeights) return 'ALL'
  const {
    borderTopWeight: t,
    borderRightWeight: r,
    borderBottomWeight: b,
    borderLeftWeight: l
  } = activeNode
  const active = [t > 0, r > 0, b > 0, l > 0]
  const count = active.filter(Boolean).length
  if (count === 4 && t === r && r === b && b === l) return 'ALL'
  if (count === 1) {
    if (t > 0) return 'TOP'
    if (b > 0) return 'BOTTOM'
    if (l > 0) return 'LEFT'
    if (r > 0) return 'RIGHT'
  }
  return 'CUSTOM'
}

function selectSide(side: StrokeSides, activeNode: SceneNode) {
  const weight = activeNode.strokes.length > 0 ? activeNode.strokes[0].weight : 1
  if (side === 'ALL') {
    store.updateNodeWithUndo(
      activeNode.id,
      {
        independentStrokeWeights: false,
        borderTopWeight: 0,
        borderRightWeight: 0,
        borderBottomWeight: 0,
        borderLeftWeight: 0
      } as Partial<SceneNode>,
      'Stroke all sides'
    )
  } else if (side === 'CUSTOM') {
    const w = activeNode.independentStrokeWeights
      ? {
          top: activeNode.borderTopWeight,
          right: activeNode.borderRightWeight,
          bottom: activeNode.borderBottomWeight,
          left: activeNode.borderLeftWeight
        }
      : { top: weight, right: weight, bottom: weight, left: weight }
    store.updateNodeWithUndo(
      activeNode.id,
      {
        independentStrokeWeights: true,
        borderTopWeight: w.top,
        borderRightWeight: w.right,
        borderBottomWeight: w.bottom,
        borderLeftWeight: w.left
      } as Partial<SceneNode>,
      'Custom stroke sides'
    )
  } else {
    store.updateNodeWithUndo(
      activeNode.id,
      {
        independentStrokeWeights: true,
        borderTopWeight: side === 'TOP' ? weight : 0,
        borderRightWeight: side === 'RIGHT' ? weight : 0,
        borderBottomWeight: side === 'BOTTOM' ? weight : 0,
        borderLeftWeight: side === 'LEFT' ? weight : 0
      } as Partial<SceneNode>,
      `Stroke ${side.toLowerCase()} only`
    )
  }
  sideMenuOpen.value = false
}

function updateBorderWeight(
  side: (typeof BORDER_SIDES)[number],
  value: number,
  activeNode: SceneNode
) {
  const key = `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
  store.updateNodeWithUndo(
    activeNode.id,
    { [key]: value } as Partial<SceneNode>,
    'Change stroke weight'
  )
}

const DEFAULT_STROKE: Stroke = {
  color: { r: 0, g: 0, b: 0, a: 1 },
  weight: 1,
  opacity: 1,
  visible: true,
  align: 'CENTER'
}
</script>

<template>
  <PropertyListRoot
    v-slot="{ items, isMixed, activeNode, add, remove, patch, toggleVisibility }"
    prop-key="strokes"
    label="Stroke"
  >
    <div data-test-id="stroke-section" :class="sectionWrapper()">
      <div class="flex items-center justify-between">
        <label :class="sectionLabel()">Stroke</label>
        <button
          data-test-id="stroke-section-add"
          :class="iconButton()"
          @click="add(DEFAULT_STROKE)"
        >
          +
        </button>
      </div>

      <p v-if="isMixed" class="text-[11px] text-muted">Click + to replace mixed strokes</p>

      <div
        v-for="(stroke, i) in items as Stroke[]"
        :key="i"
        data-test-id="stroke-item"
        :data-test-index="i"
        class="group flex items-center gap-1.5 py-0.5"
      >
        <ColorInput
          class="min-w-0 flex-1"
          :color="stroke.color"
          editable
          @update="patch(i, { color: $event })"
        />
        <button
          class="shrink-0 cursor-pointer border-none bg-transparent p-0 text-muted hover:text-surface"
          @click="toggleVisibility(i)"
        >
          <icon-lucide-eye v-if="stroke.visible" class="size-3.5" />
          <icon-lucide-eye-off v-else class="size-3.5" />
        </button>
        <button :class="iconButton({ class: 'shrink-0' })" @click="remove(i)">−</button>
      </div>

      <!-- Stroke details -->
      <div
        v-if="!isMixed && activeNode && activeNode.strokes.length > 0"
        class="mt-1 flex items-center gap-1.5"
      >
        <AppSelect
          class="w-[72px]"
          :model-value="currentAlign(activeNode)"
          :options="ALIGN_OPTIONS"
          @update:model-value="updateAlign($event as Stroke['align'], activeNode)"
        />
        <ScrubInput
          v-if="!activeNode.independentStrokeWeights"
          class="flex-1"
          :model-value="activeNode.strokes[0]?.weight ?? 1"
          :min="0"
          @update:model-value="patch(0, { weight: $event })"
        >
          <template #icon>
            <svg
              class="size-3"
              viewBox="0 0 12 12"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <line x1="1" y1="3" x2="11" y2="3" />
              <line x1="1" y1="6" x2="11" y2="6" />
              <line x1="1" y1="9" x2="11" y2="9" />
            </svg>
          </template>
        </ScrubInput>
        <DropdownMenuRoot v-model:open="sideMenuOpen">
          <Tip label="Stroke sides">
            <DropdownMenuTrigger as-child>
              <button
                class="flex size-[26px] shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-input text-muted hover:bg-hover hover:text-surface"
                :class="{ '!border-accent !text-accent': activeNode.independentStrokeWeights }"
              >
                <svg class="size-3.5" viewBox="0 0 14 14" fill="currentColor">
                  <rect x="1" y="1" width="5" height="5" rx="1" />
                  <rect x="8" y="1" width="5" height="5" rx="1" />
                  <rect x="1" y="8" width="5" height="5" rx="1" />
                  <rect x="8" y="8" width="5" height="5" rx="1" />
                </svg>
              </button>
            </DropdownMenuTrigger>
          </Tip>
          <DropdownMenuPortal>
            <DropdownMenuContent
              :side-offset="4"
              align="end"
              :class="menuContent({ class: 'min-w-[140px] rounded-md p-0.5' })"
            >
              <DropdownMenuItem
                v-for="opt in SIDE_OPTIONS"
                :key="opt.value"
                :class="menuItem({ justify: 'start', class: 'relative px-2' })"
                @click="selectSide(opt.value, activeNode)"
              >
                <icon-lucide-check
                  v-if="currentSides(activeNode) === opt.value"
                  class="absolute left-2 size-3 text-accent"
                />
                <span class="flex items-center gap-2 pl-5">
                  <svg
                    class="size-3.5"
                    viewBox="0 0 14 14"
                    fill="none"
                    stroke="currentColor"
                    stroke-width="1.5"
                  >
                    <template v-if="opt.value === 'ALL'">
                      <rect x="1" y="1" width="12" height="12" rx="1" />
                    </template>
                    <template v-else-if="opt.value === 'CUSTOM'">
                      <line x1="4" y1="7" x2="10" y2="7" />
                      <line x1="7" y1="4" x2="7" y2="10" />
                    </template>
                    <template v-else>
                      <rect
                        x="1"
                        y="1"
                        width="12"
                        height="12"
                        rx="1"
                        stroke-opacity="0.3"
                        stroke-dasharray="2 2"
                      />
                      <line v-if="opt.value === 'TOP'" x1="1" y1="1" x2="13" y2="1" />
                      <line v-else-if="opt.value === 'BOTTOM'" x1="1" y1="13" x2="13" y2="13" />
                      <line v-else-if="opt.value === 'LEFT'" x1="1" y1="1" x2="1" y2="13" />
                      <line v-else-if="opt.value === 'RIGHT'" x1="13" y1="1" x2="13" y2="13" />
                    </template>
                  </svg>
                  <span>{{ opt.label }}</span>
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenuPortal>
        </DropdownMenuRoot>
      </div>

      <!-- Individual border weights -->
      <div
        v-if="
          !isMixed &&
          activeNode &&
          activeNode.strokes.length > 0 &&
          activeNode.independentStrokeWeights
        "
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <ScrubInput
          v-for="side in BORDER_SIDES"
          :key="side"
          :model-value="
            activeNode[
              `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
            ] as number
          "
          :min="0"
          @update:model-value="updateBorderWeight(side, $event, activeNode)"
        >
          <template #icon>
            <svg class="size-3" viewBox="0 0 12 12" fill="none" stroke-width="1.5">
              <rect
                x="1"
                y="1"
                width="10"
                height="10"
                rx="1"
                stroke="currentColor"
                stroke-opacity="0.3"
                stroke-dasharray="2 2"
              />
              <line v-if="side === 'top'" x1="1" y1="1" x2="11" y2="1" stroke="currentColor" />
              <line
                v-else-if="side === 'right'"
                x1="11"
                y1="1"
                x2="11"
                y2="11"
                stroke="currentColor"
              />
              <line
                v-else-if="side === 'bottom'"
                x1="1"
                y1="11"
                x2="11"
                y2="11"
                stroke="currentColor"
              />
              <line v-else x1="1" y1="1" x2="1" y2="11" stroke="currentColor" />
            </svg>
          </template>
        </ScrubInput>
      </div>
    </div>
  </PropertyListRoot>
</template>
