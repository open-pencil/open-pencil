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
import type { SizeLimitProp } from '@open-pencil/vue'

type SizeSelectValue = LayoutSizing | `add-${SizeLimitProp}` | `remove-${SizeLimitProp}`

const ctx = useLayoutControlsContext()

const { panels } = useI18n()
const sizingSelect = useSelectUI({ item: 'rounded py-1.5 pr-2 pl-6 text-xs' })

const widthLimitItems = [
  {
    prop: 'minWidth' as const,
    addLabel: () => panels.value.addMinWidth,
    removeLabel: () => panels.value.removeMinWidth
  },
  {
    prop: 'maxWidth' as const,
    addLabel: () => panels.value.addMaxWidth,
    removeLabel: () => panels.value.removeMaxWidth
  }
]

const heightLimitItems = [
  {
    prop: 'minHeight' as const,
    addLabel: () => panels.value.addMinHeight,
    removeLabel: () => panels.value.removeMinHeight
  },
  {
    prop: 'maxHeight' as const,
    addLabel: () => panels.value.addMaxHeight,
    removeLabel: () => panels.value.removeMaxHeight
  }
]

function sizingShortLabel(sizing: LayoutSizing): string | null {
  if (sizing === 'HUG') return panels.value.sizingHugShort
  if (sizing === 'FILL') return panels.value.sizingFillShort
  return null
}

function handleSizeSelect(axis: 'width' | 'height', value: SizeSelectValue) {
  if (value === 'FIXED' || value === 'HUG' || value === 'FILL') {
    if (axis === 'width') ctx.setWidthSizing(value)
    else ctx.setHeightSizing(value)
    return
  }

  const [action, prop] = value.split('-') as ['add' | 'remove', SizeLimitProp]
  if (action === 'add') ctx.addSizeLimit(prop)
  else ctx.removeSizeLimit(prop)
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
          @update:model-value="handleSizeSelect('width', $event as SizeSelectValue)"
        >
          <SelectTrigger
            data-test-id="layout-width-sizing-menu"
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
                <SelectItem
                  v-for="item in widthLimitItems"
                  :key="item.prop"
                  :value="`${ctx.node[item.prop] == null ? 'add' : 'remove'}-${item.prop}`"
                  :class="sizingSelect.item"
                >
                  <SelectItemText>
                    {{ ctx.node[item.prop] == null ? item.addLabel() : item.removeLabel() }}
                  </SelectItemText>
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
          @update:model-value="handleSizeSelect('height', $event as SizeSelectValue)"
        >
          <SelectTrigger
            data-test-id="layout-height-sizing-menu"
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
                <SelectItem
                  v-for="item in heightLimitItems"
                  :key="item.prop"
                  :value="`${ctx.node[item.prop] == null ? 'add' : 'remove'}-${item.prop}`"
                  :class="sizingSelect.item"
                >
                  <SelectItemText>
                    {{ ctx.node[item.prop] == null ? item.addLabel() : item.removeLabel() }}
                  </SelectItemText>
                </SelectItem>
              </SelectViewport>
            </SelectContent>
          </SelectPortal>
        </SelectRoot>
      </template>
    </ScrubInput>
  </div>

  <div
    v-if="
      ctx.node.minWidth != null ||
      ctx.node.maxWidth != null ||
      ctx.node.minHeight != null ||
      ctx.node.maxHeight != null
    "
    class="mt-1.5 grid grid-cols-2 gap-1.5"
  >
    <ScrubInput
      v-if="ctx.node.minWidth != null"
      data-test-id="layout-min-width-input"
      :icon="panels.minWidthShort"
      :model-value="Math.round(ctx.node.minWidth)"
      :min="0"
      @update:model-value="ctx.updateSizeLimit('minWidth', $event)"
      @commit="(v: number, p: number) => ctx.commitSizeLimit('minWidth', v, p)"
    />
    <ScrubInput
      v-if="ctx.node.maxWidth != null"
      data-test-id="layout-max-width-input"
      :icon="panels.maxWidthShort"
      :model-value="Math.round(ctx.node.maxWidth)"
      :min="0"
      @update:model-value="ctx.updateSizeLimit('maxWidth', $event)"
      @commit="(v: number, p: number) => ctx.commitSizeLimit('maxWidth', v, p)"
    />
    <ScrubInput
      v-if="ctx.node.minHeight != null"
      data-test-id="layout-min-height-input"
      :icon="panels.minHeightShort"
      :model-value="Math.round(ctx.node.minHeight)"
      :min="0"
      @update:model-value="ctx.updateSizeLimit('minHeight', $event)"
      @commit="(v: number, p: number) => ctx.commitSizeLimit('minHeight', v, p)"
    />
    <ScrubInput
      v-if="ctx.node.maxHeight != null"
      data-test-id="layout-max-height-input"
      :icon="panels.maxHeightShort"
      :model-value="Math.round(ctx.node.maxHeight)"
      :min="0"
      @update:model-value="ctx.updateSizeLimit('maxHeight', $event)"
      @commit="(v: number, p: number) => ctx.commitSizeLimit('maxHeight', v, p)"
    />
  </div>
</template>
