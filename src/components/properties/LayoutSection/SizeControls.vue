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

import ScrubInput from '@/components/ScrubInput.vue'
import { useSelectUI } from '@/components/ui/select'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutSizing } from '@open-pencil/core/scene-graph'

const ctx = useLayoutControlsContext()

const { panels } = useI18n()
const sizingSelect = useSelectUI({ item: 'rounded py-1.5 pr-2 pl-6 text-xs' })

function sizingShortLabel(sizing: LayoutSizing): string | null {
  if (sizing === 'HUG') return panels.value.sizingHugShort
  if (sizing === 'FILL') return panels.value.sizingFillShort
  return null
}
</script>

<template>
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
</template>
