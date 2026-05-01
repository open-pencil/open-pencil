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

import ScrubInput from '@/components/ScrubInput.vue'
import { useSelectUI } from '@/components/ui/select'
import { useI18n, useLayoutControlsContext } from '@open-pencil/vue'

import type { LayoutSizing } from '@open-pencil/core/scene-graph'
import type { SizeLimitProp } from '@open-pencil/vue'

type SizeSelectValue = LayoutSizing | `add-${SizeLimitProp}` | `remove-${SizeLimitProp}`

type ActiveSizeLimit = {
  prop: SizeLimitProp
  testId: string
  icon: () => string
  value: () => number | null
  setLabel: () => string
  removeLabel: () => string
}

const ctx = useLayoutControlsContext()
const widthFieldRef = ref<HTMLElement | null>(null)
const heightFieldRef = ref<HTMLElement | null>(null)
const limitFieldRefs = ref<Record<SizeLimitProp, HTMLElement | null>>({
  minWidth: null,
  maxWidth: null,
  minHeight: null,
  maxHeight: null
})

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

const activeSizeLimits: ActiveSizeLimit[] = [
  {
    prop: 'minWidth',
    testId: 'layout-min-width-input',
    icon: () => panels.value.minWidthShort,
    value: () => ctx.node.minWidth,
    setLabel: () => panels.value.setToCurrentWidth,
    removeLabel: () => panels.value.removeMinWidth
  },
  {
    prop: 'maxWidth',
    testId: 'layout-max-width-input',
    icon: () => panels.value.maxWidthShort,
    value: () => ctx.node.maxWidth,
    setLabel: () => panels.value.setToCurrentWidth,
    removeLabel: () => panels.value.removeMaxWidth
  },
  {
    prop: 'minHeight',
    testId: 'layout-min-height-input',
    icon: () => panels.value.minHeightShort,
    value: () => ctx.node.minHeight,
    setLabel: () => panels.value.setToCurrentHeight,
    removeLabel: () => panels.value.removeMinHeight
  },
  {
    prop: 'maxHeight',
    testId: 'layout-max-height-input',
    icon: () => panels.value.maxHeightShort,
    value: () => ctx.node.maxHeight,
    setLabel: () => panels.value.setToCurrentHeight,
    removeLabel: () => panels.value.removeMaxHeight
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

function anchorRef(element: HTMLElement | null): HTMLElement | undefined {
  return element ?? undefined
}

function handleLimitSelect(prop: SizeLimitProp, value: string) {
  if (value === 'CURRENT') ctx.setSizeLimitToCurrent(prop)
  else if (value === 'REMOVE') ctx.removeSizeLimit(prop)
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
    <div ref="widthFieldRef" class="min-w-0 flex-1">
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
              :reference="anchorRef(widthFieldRef)"
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
                :side-offset="4"
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
    </div>

    <div ref="heightFieldRef" class="min-w-0 flex-1">
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
              :reference="anchorRef(heightFieldRef)"
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
                :side-offset="4"
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
    <template v-for="item in activeSizeLimits" :key="item.prop">
      <div
        v-if="item.value() != null"
        :ref="(el) => (limitFieldRefs[item.prop] = el as HTMLElement | null)"
        class="min-w-0"
      >
        <ScrubInput
          :data-test-id="item.testId"
          :icon="item.icon()"
          :model-value="Math.round(item.value() ?? 0)"
          :min="0"
          @update:model-value="ctx.updateSizeLimit(item.prop, $event)"
          @commit="(v: number, p: number) => ctx.commitSizeLimit(item.prop, v, p)"
        >
          <template #suffix>
            <SelectRoot
              :model-value="'VALUE'"
              @update:model-value="(value) => handleLimitSelect(item.prop, value as string)"
            >
              <SelectTrigger
                :data-test-id="`${item.testId}-menu`"
                :reference="anchorRef(limitFieldRefs[item.prop])"
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
                  :class="sizingSelect.content"
                >
                  <SelectViewport class="p-0.5">
                    <SelectItem value="CURRENT" :class="sizingSelect.item">
                      <SelectItemText>{{ item.setLabel() }}</SelectItemText>
                    </SelectItem>
                    <SelectItem value="REMOVE" :class="sizingSelect.item">
                      <SelectItemText>{{ item.removeLabel() }}</SelectItemText>
                    </SelectItem>
                  </SelectViewport>
                </SelectContent>
              </SelectPortal>
            </SelectRoot>
          </template>
        </ScrubInput>
      </div>
    </template>
  </div>
</template>
