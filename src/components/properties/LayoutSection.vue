<script setup lang="ts">
import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectViewport
} from 'reka-ui'

import { LayoutControlsRoot, useI18n } from '@open-pencil/vue'

import AppSelect from '@/components/ui/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/ui/Tip.vue'
import { useSelectUI } from '@/components/ui/select'
import { useSectionUI } from '@/components/ui/section'

import type { LayoutSizing } from '@open-pencil/core'

const { panels } = useI18n()
const sectionCls = useSectionUI()

const CONTAINER_TYPES = ['FRAME', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE']

const sizingSelect = useSelectUI({
  item: 'rounded py-1.5 pr-2 pl-6 text-xs'
})

function sizingShortLabel(sizing: LayoutSizing): string | null {
  if (sizing === 'HUG') return panels.value.sizingHugShort
  if (sizing === 'FILL') return panels.value.sizingFillShort
  return null
}
</script>

<template>
  <LayoutControlsRoot v-slot="ctx">
    <template v-if="ctx.node">
      <div data-test-id="layout-section" :class="sectionCls.wrapper">
        <label class="mb-1.5 block text-[11px] text-muted">{{ panels.layout }}</label>
        <div class="flex gap-1.5">
          <ScrubInput
            icon="W"
            :model-value="Math.round(ctx.node.width)"
            :min="0"
            @update:model-value="ctx.updateProp('width', $event)"
            @commit="(v: number, p: number) => ctx.commitProp('width', v, p)"
          >
            <template v-if="ctx.isFlex || ctx.isInAutoLayout" #suffix>
              <SelectRoot
                :model-value="ctx.widthSizing"
                @update:model-value="ctx.setWidthSizing($event as LayoutSizing)"
              >
                <SelectTrigger
                  class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-[11px] text-muted outline-none"
                  @pointerdown.stop
                >
                  <span class="group-hover:hidden">{{ sizingShortLabel(ctx.widthSizing) }}</span>
                  <icon-lucide-chevron-down class="hidden size-3 group-hover:block" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectContent
                    position="popper"
                    align="start"
                    :side-offset="2"
                    :class="sizingSelect.content"
                  >
                    <SelectViewport class="p-0.5">
                      <SelectItem
                        v-for="opt in ctx.widthSizingOptions"
                        :key="opt.value"
                        :value="opt.value"
                        :class="sizingSelect.item"
                      >
                        <SelectItemIndicator
                          class="absolute left-1.5 inline-flex items-center justify-center"
                        >
                          <icon-lucide-check class="size-3 text-accent" />
                        </SelectItemIndicator>
                        <SelectItemText>{{ opt.label }}</SelectItemText>
                      </SelectItem>
                    </SelectViewport>
                  </SelectContent>
                </SelectPortal>
              </SelectRoot>
            </template>
          </ScrubInput>
          <ScrubInput
            icon="H"
            :model-value="Math.round(ctx.node.height)"
            :min="0"
            @update:model-value="ctx.updateProp('height', $event)"
            @commit="(v: number, p: number) => ctx.commitProp('height', v, p)"
          >
            <template v-if="ctx.isFlex || ctx.isInAutoLayout" #suffix>
              <SelectRoot
                :model-value="ctx.heightSizing"
                @update:model-value="ctx.setHeightSizing($event as LayoutSizing)"
              >
                <SelectTrigger
                  class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-[11px] text-muted outline-none"
                  @pointerdown.stop
                >
                  <span class="group-hover:hidden">{{ sizingShortLabel(ctx.heightSizing) }}</span>
                  <icon-lucide-chevron-down class="hidden size-3 group-hover:block" />
                </SelectTrigger>
                <SelectPortal>
                  <SelectContent
                    position="popper"
                    align="start"
                    :side-offset="2"
                    :class="sizingSelect.content"
                  >
                    <SelectViewport class="p-0.5">
                      <SelectItem
                        v-for="opt in ctx.heightSizingOptions"
                        :key="opt.value"
                        :value="opt.value"
                        :class="sizingSelect.item"
                      >
                        <SelectItemIndicator
                          class="absolute left-1.5 inline-flex items-center justify-center"
                        >
                          <icon-lucide-check class="size-3 text-accent" />
                        </SelectItemIndicator>
                        <SelectItemText>{{ opt.label }}</SelectItemText>
                      </SelectItem>
                    </SelectViewport>
                  </SelectContent>
                </SelectPortal>
              </SelectRoot>
            </template>
          </ScrubInput>
        </div>
      </div>

      <template v-if="CONTAINER_TYPES.includes(ctx.node.type)">
        <div :class="sectionCls.wrapper">
          <div class="flex items-center justify-between">
            <label class="mb-1.5 block text-[11px] text-muted">{{ panels.autoLayout }}</label>
            <Tip v-if="ctx.node.layoutMode === 'NONE'" :label="panels.addAutoLayout">
              <button tabindex="0"
                class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
                data-test-id="layout-add-auto"
                @click="ctx.editor.setLayoutMode(ctx.node.id, 'VERTICAL')"
              >
                +
              </button>
            </Tip>
            <Tip v-else :label="panels.removeAutoLayout">
              <button tabindex="0"
                class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
                data-test-id="layout-remove-auto"
                @click="ctx.editor.setLayoutMode(ctx.node.id, 'NONE')"
              >
                −
              </button>
            </Tip>
          </div>

          <template v-if="ctx.node.layoutMode !== 'NONE'">
            <div class="mt-1.5 flex gap-0.5">
              <button tabindex="0"
                v-for="dir in [
                  { mode: 'HORIZONTAL', test: 'horizontal' },
                  { mode: 'VERTICAL', test: 'vertical' },
                  { mode: 'GRID', test: 'grid' }
                ] as const"
                :key="dir.mode"
                :data-test-id="`layout-direction-${dir.test}`"
                class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
                :class="
                  (dir.mode === 'GRID' ? ctx.isGrid : ctx.node.layoutMode === dir.mode)
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:bg-hover hover:text-surface'
                "
                @click="ctx.editor.setLayoutMode(ctx.node.id, dir.mode)"
              >
                <icon-lucide-arrow-right v-if="dir.mode === 'HORIZONTAL'" class="size-3.5" />
                <icon-lucide-arrow-down v-else-if="dir.mode === 'VERTICAL'" class="size-3.5" />
                <icon-lucide-layout-grid v-else class="size-3.5" />
              </button>
              <button tabindex="0"
                v-if="ctx.isFlex"
                data-test-id="layout-direction-wrap"
                class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
                :class="
                  ctx.node.layoutWrap === 'WRAP'
                    ? 'border-accent bg-accent/10 text-accent'
                    : 'border-border text-muted hover:bg-hover hover:text-surface'
                "
                @click="
                  ctx.updateProp('layoutWrap', ctx.node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')
                "
              >
                <icon-lucide-wrap-text class="size-3.5" />
              </button>
            </div>

            <div v-if="ctx.isFlex" class="mt-2">
              <label class="mb-1 block text-[11px] text-muted">{{ panels.flow }}</label>
              <AppSelect
                :model-value="ctx.layoutDirection"
                :options="[
                  { value: 'AUTO', label: panels.auto },
                  { value: 'LTR', label: 'LTR' },
                  { value: 'RTL', label: 'RTL' }
                ]"
                @update:model-value="ctx.setLayoutDirection($event as 'AUTO' | 'LTR' | 'RTL')"
              />
            </div>

            <template v-if="ctx.isGrid">
              <div
                v-for="trackProp in ['gridTemplateColumns', 'gridTemplateRows'] as const"
                :key="trackProp"
                class="mt-2"
              >
                <div class="mb-1 flex items-center justify-between">
                  <label class="text-[11px] text-muted">{{
                    trackProp === 'gridTemplateColumns' ? panels.columns : panels.rows
                  }}</label>
                  <button tabindex="0"
                    class="cursor-pointer rounded border-none bg-transparent px-1 text-xs leading-none text-muted hover:bg-hover hover:text-surface"
                    @click="ctx.addTrack(trackProp)"
                  >
                    +
                  </button>
                </div>
                <div class="flex flex-col gap-1">
                  <div
                    v-for="(track, i) in ctx.node[trackProp]"
                    :key="i"
                    class="flex items-center gap-1"
                  >
                    <ScrubInput
                      v-if="track.sizing !== 'AUTO'"
                      class="flex-1"
                      :icon="`${trackProp === 'gridTemplateColumns' ? 'C' : 'R'}${i + 1}`"
                      :model-value="track.value"
                      :min="track.sizing === 'FR' ? 1 : 0"
                      :suffix="track.sizing === 'FR' ? 'fr' : 'px'"
                      @update:model-value="ctx.updateGridTrack(trackProp, i, { value: $event })"
                    />
                    <span v-else class="flex-1 px-1 text-xs text-muted">{{
                      ctx.trackLabel(track)
                    }}</span>
                    <AppSelect
                      :model-value="track.sizing"
                      :options="ctx.trackSizingOptions"
                      @update:model-value="
                        ctx.updateGridTrack(trackProp, i, {
                          sizing: $event,
                          value: $event === 'FR' ? 1 : $event === 'FIXED' ? 100 : 0
                        })
                      "
                    />
                    <button tabindex="0"
                      v-if="ctx.node[trackProp].length > 1"
                      class="cursor-pointer rounded border-none bg-transparent px-0.5 text-xs text-muted hover:text-surface"
                      @click="ctx.removeTrack(trackProp, i)"
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
              <div class="mt-2 grid grid-cols-2 gap-1.5">
                <ScrubInput
                  icon="↔"
                  :model-value="Math.round(ctx.node.gridColumnGap)"
                  :min="0"
                  @update:model-value="ctx.updateProp('gridColumnGap', $event)"
                  @commit="(v: number, p: number) => ctx.commitProp('gridColumnGap', v, p)"
                />
                <ScrubInput
                  icon="↕"
                  :model-value="Math.round(ctx.node.gridRowGap)"
                  :min="0"
                  @update:model-value="ctx.updateProp('gridRowGap', $event)"
                  @commit="(v: number, p: number) => ctx.commitProp('gridRowGap', v, p)"
                />
              </div>
            </template>

            <template v-if="ctx.isFlex">
              <div class="mt-2 flex items-center gap-1.5">
                <ScrubInput
                  data-test-id="layout-gap-input"
                  class="flex-1"
                  :icon="ctx.node.layoutMode === 'VERTICAL' ? '↕' : '↔'"
                  :model-value="Math.round(ctx.node.itemSpacing)"
                  :min="0"
                  @update:model-value="ctx.updateProp('itemSpacing', $event)"
                  @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
                />
                <button tabindex="0"
                  class="flex size-7 shrink-0 cursor-pointer items-center justify-center rounded border border-border bg-transparent text-muted hover:bg-hover hover:text-surface"
                  @click="ctx.toggleIndividualPadding"
                >
                  <icon-lucide-minus
                    v-if="ctx.showIndividualPadding || !ctx.hasUniformPadding"
                    class="size-3"
                  />
                  <icon-lucide-plus v-else class="size-3" />
                </button>
              </div>
              <div v-if="!ctx.showIndividualPadding && ctx.hasUniformPadding" class="mt-1.5">
                <ScrubInput
                  data-test-id="layout-uniform-padding-input"
                  icon="☐"
                  :model-value="Math.round(ctx.node.paddingTop)"
                  :min="0"
                  @update:model-value="ctx.setUniformPadding"
                  @commit="ctx.commitUniformPadding"
                />
              </div>
            </template>

            <template
              v-if="
                ctx.isGrid || (ctx.isFlex && (ctx.showIndividualPadding || !ctx.hasUniformPadding))
              "
            >
              <div class="mt-1.5 grid grid-cols-2 gap-1.5">
                <ScrubInput
                  v-for="side in [
                    'paddingTop',
                    'paddingRight',
                    'paddingBottom',
                    'paddingLeft'
                  ] as const"
                  :key="side"
                  :icon="side[7]"
                  :model-value="Math.round(ctx.node[side])"
                  :min="0"
                  @update:model-value="ctx.updateProp(side, $event)"
                  @commit="(v: number, p: number) => ctx.commitProp(side, v, p)"
                />
              </div>
            </template>

            <div v-if="ctx.isFlex" class="mt-2">
              <label class="mb-1 block text-[11px] text-muted">{{ panels.alignment }}</label>
              <div data-test-id="layout-alignment-grid" class="grid w-fit grid-cols-3 gap-0.5">
                <button tabindex="0"
                  v-for="cell in ctx.alignGrid"
                  :key="`${cell.primary}-${cell.counter}`"
                  class="flex size-6 cursor-pointer items-center justify-center rounded border text-[11px]"
                  :class="
                    ctx.node.primaryAxisAlign === cell.primary &&
                    ctx.node.counterAxisAlign === cell.counter
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-border text-muted hover:bg-hover hover:text-surface'
                  "
                  @click="ctx.setAlignment(cell.primary, cell.counter)"
                >
                  <span class="size-1.5 rounded-full bg-current" />
                </button>
              </div>
            </div>
          </template>
        </div>

        <div :class="sectionCls.wrapper">
          <label class="flex cursor-pointer items-center gap-2 text-xs text-surface">
            <input
              type="checkbox"
              data-test-id="clip-content-checkbox"
              class="accent-accent"
              :checked="ctx.node.clipsContent"
              @change="
                ctx.editor.updateNodeWithUndo(
                  ctx.node.id,
                  { clipsContent: !ctx.node.clipsContent },
                  'Toggle clip content'
                )
              "
            />
            {{ panels.clipContent }}
          </label>
        </div>
      </template>
    </template>
  </LayoutControlsRoot>
</template>
