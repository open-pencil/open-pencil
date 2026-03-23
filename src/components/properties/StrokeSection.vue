<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'

import { PropertyListRoot, useStrokeControls } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import ColorInput from '@/components/ColorInput.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { iconButton } from '@/components/ui/icon-button'
import { menu, useMenuUI } from '@/components/ui/menu'
import { sectionLabel, sectionWrapper } from '@/components/ui/section'

import type { SceneNode, Stroke } from '@open-pencil/core'

const strokeCtx = useStrokeControls()
const sideMenuCls = useMenuUI({
  content: 'min-w-[140px] rounded-md p-0.5',
  item: 'relative px-2'
})
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
          @click="add(strokeCtx.defaultStroke)"
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
        <button :class="iconButton({ ui: { base: 'shrink-0' } })" @click="remove(i)">−</button>
      </div>

      <div v-if="!isMixed && activeNode && activeNode.strokes.length > 0" class="mt-1 flex items-center gap-1.5">
        <AppSelect
          class="w-[72px]"
          :model-value="strokeCtx.currentAlign(activeNode)"
          :options="strokeCtx.alignOptions"
          @update:model-value="strokeCtx.updateAlign($event as Stroke['align'], activeNode)"
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
        <DropdownMenuRoot v-model:open="strokeCtx.sideMenuOpen.value">
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
            <DropdownMenuContent :side-offset="4" align="end" :class="sideMenuCls.content">
              <DropdownMenuItem
                v-for="opt in strokeCtx.sideOptions"
                :key="opt.value"
                :class="menu({ justify: 'start' }).item({ class: sideMenuCls.item })"
                @click="strokeCtx.selectSide(opt.value, activeNode)"
              >
                <icon-lucide-check
                  v-if="strokeCtx.currentSides(activeNode) === opt.value"
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

      <div
        v-if="!isMixed && activeNode && activeNode.strokes.length > 0 && activeNode.independentStrokeWeights"
        class="mt-1.5 grid grid-cols-2 gap-1.5"
      >
        <ScrubInput
          v-for="side in strokeCtx.borderSides"
          :key="side"
          :model-value="
            activeNode[
              `border${side[0].toUpperCase()}${side.slice(1)}Weight` as keyof SceneNode
            ] as number
          "
          :min="0"
          @update:model-value="strokeCtx.updateBorderWeight(side, $event, activeNode)"
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
