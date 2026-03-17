<script setup lang="ts">
import AppSelect from '@/components/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import Tip from '@/components/Tip.vue'
import { sectionWrapper } from '@/components/ui/section'
import { useLayout } from '@open-pencil/vue'

const {
  editor: store,
  node,
  isInAutoLayout,
  isGrid,
  isFlex,
  widthSizing,
  heightSizing,
  widthSizingOptions,
  heightSizingOptions,
  alignGrid,
  showIndividualPadding,
  hasUniformPadding,
  trackSizingOptions,
  updateProp,
  commitProp,
  setWidthSizing,
  setHeightSizing,
  setUniformPadding,
  commitUniformPadding,
  setAlignment,
  updateGridTrack,
  addTrack,
  removeTrack,
  trackLabel,
  toggleIndividualPadding
} = useLayout()
</script>

<template>
  <template v-if="node">
    <div data-test-id="layout-section" :class="sectionWrapper()">
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

    <template v-if="node.type === 'FRAME'">
      <div :class="sectionWrapper()">
        <div class="flex items-center justify-between">
          <label class="mb-1.5 block text-[11px] text-muted">Auto layout</label>
          <Tip v-if="node.layoutMode === 'NONE'" label="Add auto layout (Shift+A)">
            <button
              class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
              data-test-id="layout-add-auto"
              @click="store.setLayoutMode(node.id, 'VERTICAL')"
            >
              +
            </button>
          </Tip>
          <Tip v-else label="Remove auto layout">
            <button
              class="cursor-pointer rounded border-none bg-transparent px-1 text-base leading-none text-muted hover:bg-hover hover:text-surface"
              data-test-id="layout-remove-auto"
              @click="store.setLayoutMode(node.id, 'NONE')"
            >
              −
            </button>
          </Tip>
        </div>

        <template v-if="node.layoutMode !== 'NONE'">
          <div class="mt-1.5 flex gap-0.5">
            <button
              v-for="dir in [
                { mode: 'HORIZONTAL', icon: 'arrow-right', test: 'horizontal' },
                { mode: 'VERTICAL', icon: 'arrow-down', test: 'vertical' },
                { mode: 'GRID', icon: 'layout-grid', test: 'grid' }
              ] as const"
              :key="dir.mode"
              :data-test-id="`layout-direction-${dir.test}`"
              class="flex cursor-pointer items-center justify-center rounded border px-2 py-1"
              :class="
                (dir.mode === 'GRID' ? isGrid : node.layoutMode === dir.mode)
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted hover:bg-hover hover:text-surface'
              "
              @click="store.setLayoutMode(node.id, dir.mode)"
            >
              <component :is="`icon-lucide-${dir.icon}`" class="size-3.5" />
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
              @click="updateProp('layoutWrap', node.layoutWrap === 'WRAP' ? 'NO_WRAP' : 'WRAP')"
            >
              <icon-lucide-wrap-text class="size-3.5" />
            </button>
          </div>

          <!-- Grid tracks -->
          <template v-if="isGrid">
            <div
              v-for="trackProp in ['gridTemplateColumns', 'gridTemplateRows'] as const"
              :key="trackProp"
              class="mt-2"
            >
              <div class="mb-1 flex items-center justify-between">
                <label class="text-[11px] text-muted">{{
                  trackProp === 'gridTemplateColumns' ? 'Columns' : 'Rows'
                }}</label>
                <button
                  class="cursor-pointer rounded border-none bg-transparent px-1 text-xs leading-none text-muted hover:bg-hover hover:text-surface"
                  @click="addTrack(trackProp)"
                >
                  +
                </button>
              </div>
              <div class="flex flex-col gap-1">
                <div v-for="(track, i) in node[trackProp]" :key="i" class="flex items-center gap-1">
                  <ScrubInput
                    v-if="track.sizing !== 'AUTO'"
                    class="flex-1"
                    :icon="`${trackProp === 'gridTemplateColumns' ? 'C' : 'R'}${i + 1}`"
                    :model-value="track.value"
                    :min="track.sizing === 'FR' ? 1 : 0"
                    :suffix="track.sizing === 'FR' ? 'fr' : 'px'"
                    @update:model-value="updateGridTrack(trackProp, i, { value: $event })"
                  />
                  <span v-else class="flex-1 px-1 text-xs text-muted">{{ trackLabel(track) }}</span>
                  <AppSelect
                    :model-value="track.sizing"
                    :options="trackSizingOptions"
                    @update:model-value="
                      updateGridTrack(trackProp, i, {
                        sizing: $event,
                        value: $event === 'FR' ? 1 : $event === 'FIXED' ? 100 : 0
                      })
                    "
                  />
                  <button
                    v-if="node[trackProp].length > 1"
                    class="cursor-pointer rounded border-none bg-transparent px-0.5 text-xs text-muted hover:text-surface"
                    @click="removeTrack(trackProp, i)"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
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

          <!-- Flex gap + padding toggle -->
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
                @click="toggleIndividualPadding"
              >
                <icon-lucide-minus
                  v-if="showIndividualPadding || !hasUniformPadding"
                  class="size-3"
                />
                <icon-lucide-plus v-else class="size-3" />
              </button>
            </div>
            <div v-if="!showIndividualPadding && hasUniformPadding" class="mt-1.5">
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
          <template v-if="isGrid || (isFlex && (showIndividualPadding || !hasUniformPadding))">
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
                :model-value="Math.round(node[side])"
                :min="0"
                @update:model-value="updateProp(side, $event)"
                @commit="(v: number, p: number) => commitProp(side, v, p)"
              />
            </div>
          </template>

          <!-- Alignment grid (flex only) -->
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

      <!-- Clip content -->
      <div :class="sectionWrapper()">
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
  </template>
</template>
