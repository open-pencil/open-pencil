<script setup lang="ts">
import { ref } from 'vue'
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

import AppSelect from '@/components/ui/AppSelect.vue'
import ScrubInput from '@/components/ScrubInput.vue'
import ClipContentControl from '@/components/properties/LayoutSection/ClipContentControl.vue'
import PaddingControls from '@/components/properties/LayoutSection/PaddingControls.vue'
import { useSelectUI } from '@/components/ui/select'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutDirection, LayoutAlign } from '@open-pencil/core/scene-graph'

const ctx = useLayoutControlsContext()
const gapFieldRef = ref<HTMLElement | null>(null)

const { panels } = useI18n()
const gapSelect = useSelectUI({ item: 'rounded py-1.5 pr-2 pl-6 text-xs' })

function anchorRef(element: HTMLElement | null): HTMLElement | undefined {
  return element ?? undefined
}

function setGapMode(value: string) {
  ctx.setGapAuto(value === 'AUTO')
}

function isAlignmentActive(primary: LayoutAlign, counter: string) {
  if (ctx.gapAuto)
    return ctx.node.primaryAxisAlign === 'SPACE_BETWEEN' && ctx.node.counterAxisAlign === counter
  return ctx.node.primaryAxisAlign === primary && ctx.node.counterAxisAlign === counter
}
</script>

<template>
  <div class="mt-2">
    <label class="mb-1 block text-[11px] text-muted">{{ panels.flow }}</label>
    <AppSelect
      :model-value="ctx.layoutDirection"
      :options="[
        { value: 'AUTO', label: panels.auto },
        { value: 'LTR', label: 'LTR' },
        { value: 'RTL', label: 'RTL' }
      ]"
      @update:model-value="ctx.setLayoutDirection($event as LayoutDirection)"
    />
  </div>

  <div class="mt-2 flex items-center gap-1.5">
    <template v-if="ctx.node.layoutWrap === 'WRAP'">
      <ScrubInput
        data-test-id="layout-gap-input"
        class="min-w-0 flex-1"
        :label="ctx.node.layoutMode === 'VERTICAL' ? panels.verticalGap : panels.horizontalGap"
        :model-value="Math.round(ctx.node.itemSpacing)"
        :min="0"
        @update:model-value="ctx.updateProp('itemSpacing', $event)"
        @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
      >
        <template #icon>
          <icon-lucide-align-vertical-space-between
            v-if="ctx.node.layoutMode === 'VERTICAL'"
            class="size-3.5"
          />
          <icon-lucide-align-horizontal-space-between v-else class="size-3.5" />
        </template>
      </ScrubInput>
      <ScrubInput
        data-test-id="layout-cross-gap-input"
        class="min-w-0 flex-1"
        :label="ctx.node.layoutMode === 'VERTICAL' ? panels.horizontalGap : panels.verticalGap"
        :model-value="Math.round(ctx.node.counterAxisSpacing)"
        :min="0"
        @update:model-value="ctx.updateProp('counterAxisSpacing', $event)"
        @commit="(v: number, p: number) => ctx.commitProp('counterAxisSpacing', v, p)"
      >
        <template #icon>
          <icon-lucide-align-horizontal-space-between
            v-if="ctx.node.layoutMode === 'VERTICAL'"
            class="size-3.5"
          />
          <icon-lucide-align-vertical-space-between v-else class="size-3.5" />
        </template>
      </ScrubInput>
    </template>
    <template v-else>
      <div
        v-if="ctx.gapAuto"
        ref="gapFieldRef"
        data-test-id="layout-gap-input"
        class="group flex h-[26px] min-w-0 flex-1 items-center rounded border border-border bg-input focus-within:border-accent"
      >
        <span class="flex shrink-0 items-center justify-center self-stretch px-[5px] text-muted">
          <icon-lucide-align-vertical-space-between
            v-if="ctx.node.layoutMode === 'VERTICAL'"
            class="size-3.5"
          />
          <icon-lucide-align-horizontal-space-between v-else class="size-3.5" />
        </span>
        <span class="flex-1 truncate text-xs text-surface">{{ panels.auto }}</span>
        <SelectRoot :model-value="'AUTO'" @update:model-value="setGapMode">
          <SelectTrigger
            data-test-id="layout-gap-menu"
            :reference="anchorRef(gapFieldRef)"
            class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-[11px] text-muted outline-none"
            @pointerdown.stop
          >
            <icon-lucide-chevron-down class="size-3" />
          </SelectTrigger>
          <SelectPortal>
            <SelectContent
              position="popper"
              align="start"
              :side-offset="4"
              :class="gapSelect.content"
            >
              <SelectViewport class="p-0.5">
                <SelectItem value="FIXED" :class="gapSelect.item">
                  <SelectItemText>{{ Math.round(ctx.node.itemSpacing) }}</SelectItemText>
                </SelectItem>
                <SelectItem value="AUTO" :class="gapSelect.item">
                  <SelectItemIndicator
                    class="absolute left-1.5 inline-flex items-center justify-center"
                  >
                    <icon-lucide-check class="size-3 text-accent" />
                  </SelectItemIndicator>
                  <SelectItemText>{{ panels.auto }}</SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </div>
      <div v-else ref="gapFieldRef" class="min-w-0 flex-1">
        <ScrubInput
          data-test-id="layout-gap-input"
          class="w-full"
          :model-value="Math.round(ctx.node.itemSpacing)"
          :min="0"
          @update:model-value="ctx.updateProp('itemSpacing', $event)"
          @commit="(v: number, p: number) => ctx.commitProp('itemSpacing', v, p)"
        >
          <template #icon>
            <icon-lucide-align-vertical-space-between
              v-if="ctx.node.layoutMode === 'VERTICAL'"
              class="size-3.5"
            />
            <icon-lucide-align-horizontal-space-between v-else class="size-3.5" />
          </template>
          <template #suffix>
            <SelectRoot :model-value="'FIXED'" @update:model-value="setGapMode">
              <SelectTrigger
                data-test-id="layout-gap-menu"
                :reference="anchorRef(gapFieldRef)"
                class="flex shrink-0 cursor-pointer items-center self-stretch border-none bg-transparent px-1 text-[11px] text-muted outline-none"
                @pointerdown.stop
              >
                <icon-lucide-chevron-down class="size-3" />
              </SelectTrigger>
              <SelectPortal>
                <SelectContent
                  position="popper"
                  align="start"
                  :side-offset="4"
                  :class="gapSelect.content"
                >
                  <SelectViewport class="p-0.5">
                    <SelectItem value="FIXED" :class="gapSelect.item">
                      <SelectItemIndicator
                        class="absolute left-1.5 inline-flex items-center justify-center"
                      >
                        <icon-lucide-check class="size-3 text-accent" />
                      </SelectItemIndicator>
                      <SelectItemText>{{ Math.round(ctx.node.itemSpacing) }}</SelectItemText>
                    </SelectItem>
                    <SelectItem value="AUTO" :class="gapSelect.item">
                      <SelectItemText>{{ panels.auto }}</SelectItemText>
                    </SelectItem>
                  </SelectViewport>
                </SelectContent>
              </SelectPortal>
            </SelectRoot>
          </template>
        </ScrubInput>
      </div>
    </template>
    <button
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

  <PaddingControls />
  <ClipContentControl />

  <div class="mt-2">
    <label class="mb-1 block text-[11px] text-muted">{{ panels.alignment }}</label>
    <div data-test-id="layout-alignment-grid" class="grid w-fit grid-cols-3 gap-0.5">
      <button
        v-for="cell in ctx.alignGrid"
        :key="`${cell.primary}-${cell.counter}`"
        class="flex size-6 cursor-pointer items-center justify-center rounded border text-[11px]"
        :class="
          isAlignmentActive(cell.primary, cell.counter)
            ? 'border-accent bg-accent/10 text-accent'
            : 'border-border text-muted hover:bg-hover hover:text-surface'
        "
        @click="ctx.setAlignment(ctx.gapAuto ? 'SPACE_BETWEEN' : cell.primary, cell.counter)"
      >
        <span class="size-1.5 rounded-full bg-current" />
      </button>
    </div>
  </div>
</template>
