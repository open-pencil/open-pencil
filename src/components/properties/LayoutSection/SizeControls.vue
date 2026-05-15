<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTemplateRefsList } from '@vueuse/core'
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
import VariableScrubInput from '@/components/properties/VariableScrubInput.vue'
import BoundVariableButton from '@/components/properties/BoundVariableButton.vue'
import VariablePickerPopover from '@/components/properties/VariablePickerPopover.vue'
import { useSelectUI } from '@/components/ui/select'
import {
  testId as testIdAttr,
  vTestId,
  useI18n,
  useLayoutControlsContext,
  useNumberVariableBinding
} from '@open-pencil/vue'

import type { LayoutSizing } from '@open-pencil/core/scene-graph'
import type { SizeLimitProp, TestId } from '@open-pencil/vue'

type SizeSelectValue = LayoutSizing | `add-${SizeLimitProp}` | `remove-${SizeLimitProp}`

type ActiveSizeLimit = {
  prop: SizeLimitProp
  testId: TestId
  icon: () => string
  value: () => number | null
  setLabel: () => string
  removeLabel: () => string
}

const ctx = useLayoutControlsContext()
const widthVariableBinding = useNumberVariableBinding('width')
const heightVariableBinding = useNumberVariableBinding('height')
const widthFieldRef = ref<HTMLElement | null>(null)
const heightFieldRef = ref<HTMLElement | null>(null)
const limitFieldRefs = useTemplateRefsList<HTMLElement>()

const { panels, dialogs } = useI18n()
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

const visibleSizeLimits = computed(() => activeSizeLimits.filter((item) => item.value() != null))

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

function anchorRef(element: HTMLElement | null): HTMLElement | undefined {
  return element ?? undefined
}

function limitFieldAnchor(index: number): HTMLElement | undefined {
  return anchorRef(limitFieldRefs.value[index] ?? null)
}

function handleLimitSelect(prop: SizeLimitProp, value: string) {
  if (value === 'CURRENT') ctx.setSizeLimitToCurrent(prop)
  else if (value === 'REMOVE') ctx.removeSizeLimit(prop)
}

function resolvedBoundNumber(axis: 'width' | 'height'): number | undefined {
  const binding = axis === 'width' ? widthVariableBinding : heightVariableBinding
  const variable = binding.getBoundVariable(ctx.node.id)
  return variable ? binding.store.resolveNumberVariable(variable.id) : undefined
}

function updateSizeProp(axis: 'width' | 'height', value: number) {
  const binding = axis === 'width' ? widthVariableBinding : heightVariableBinding
  if (binding.getBoundVariable(ctx.node.id)) binding.unbindVariable(ctx.node.id)
  ctx.updateProp(axis, value)
}

function commitSizeProp(axis: 'width' | 'height', value: number, previous: number) {
  ctx.commitProp(axis, value, previous)
}

function bindSizeVariable(axis: 'width' | 'height', variableId: string) {
  const binding = axis === 'width' ? widthVariableBinding : heightVariableBinding
  binding.bindVariable(ctx.node.id, variableId)
  const value = binding.store.resolveNumberVariable(variableId)
  if (value != null) ctx.updateProp(axis, value)
}

function createAndBindSizeVariable(axis: 'width' | 'height', name: string) {
  const binding = axis === 'width' ? widthVariableBinding : heightVariableBinding
  const value = ctx.node[axis]
  binding.createAndBindVariable(ctx.node.id, value, name)
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
        data-test-id="layout-width-input"
        icon="W"
        :model-value="Math.round(resolvedBoundNumber('width') ?? ctx.node.width)"
        :min="0"
        @update:model-value="updateSizeProp('width', $event)"
        @commit="(v: number, p: number) => commitSizeProp('width', v, p)"
      >
        <template #suffix>
          <BoundVariableButton
            v-if="widthVariableBinding.getBoundVariable(ctx.node.id)"
            test-id="layout-width-unbind-variable"
            :label="panels.detachVariable"
            @detach="widthVariableBinding.unbindVariable(ctx.node.id)"
          />
          <VariablePickerPopover
            v-else
            v-model:search-term="widthVariableBinding.searchTerm.value"
            :variables="widthVariableBinding.filteredVariables.value"
            :trigger-label="panels.applyVariable"
            :search-placeholder="dialogs.search"
            :empty-label="panels.noVariablesFound"
            :trigger-test-id="'layout-width-apply-variable'"
            :create-label="panels.createNumberVariable({ value: Math.round(ctx.node.width) })"
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
            :create-test-id="'layout-width-apply-variable-create'"
            @select="bindSizeVariable('width', $event.id)"
            @create="createAndBindSizeVariable('width', $event)"
          />
          <SelectRoot
            :model-value="ctx.widthSizing"
            @update:model-value="handleSizeSelect('width', $event as SizeSelectValue)"
          >
            <SelectTrigger
              data-test-id="layout-width-sizing-menu"
              :reference="anchorRef(widthFieldRef)"
              class="flex shrink-0 cursor-pointer items-center justify-center self-stretch border-none bg-transparent px-1.5 text-[11px] text-muted outline-none"
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
        data-test-id="layout-height-input"
        icon="H"
        :model-value="Math.round(resolvedBoundNumber('height') ?? ctx.node.height)"
        :min="0"
        @update:model-value="updateSizeProp('height', $event)"
        @commit="(v: number, p: number) => commitSizeProp('height', v, p)"
      >
        <template #suffix>
          <BoundVariableButton
            v-if="heightVariableBinding.getBoundVariable(ctx.node.id)"
            test-id="layout-height-unbind-variable"
            :label="panels.detachVariable"
            @detach="heightVariableBinding.unbindVariable(ctx.node.id)"
          />
          <VariablePickerPopover
            v-else
            v-model:search-term="heightVariableBinding.searchTerm.value"
            :variables="heightVariableBinding.filteredVariables.value"
            :trigger-label="panels.applyVariable"
            :search-placeholder="dialogs.search"
            :empty-label="panels.noVariablesFound"
            :trigger-test-id="'layout-height-apply-variable'"
            :create-label="panels.createNumberVariable({ value: Math.round(ctx.node.height) })"
            :create-name-placeholder="panels.variableName"
            :create-submit-label="panels.create"
            :create-test-id="'layout-height-apply-variable-create'"
            @select="bindSizeVariable('height', $event.id)"
            @create="createAndBindSizeVariable('height', $event)"
          />
          <SelectRoot
            :model-value="ctx.heightSizing"
            @update:model-value="handleSizeSelect('height', $event as SizeSelectValue)"
          >
            <SelectTrigger
              data-test-id="layout-height-sizing-menu"
              :reference="anchorRef(heightFieldRef)"
              class="flex shrink-0 cursor-pointer items-center justify-center self-stretch border-none bg-transparent px-1.5 text-[11px] text-muted outline-none"
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
    <template v-for="(item, index) in visibleSizeLimits" :key="item.prop">
      <div :ref="limitFieldRefs.set" class="min-w-0">
        <VariableScrubInput
          v-if="ctx.node"
          v-bind="testIdAttr(item.testId)"
          :icon="item.icon()"
          :model-value="Math.round(item.value() ?? 0)"
          :min="0"
          :node-id="ctx.node.id"
          :binding-path="item.prop"
          @update:model-value="ctx.updateSizeLimit(item.prop, $event)"
          @commit="(v: number, p: number) => ctx.commitSizeLimit(item.prop, v, p)"
        >
          <template #after-variable>
            <SelectRoot
              :model-value="'VALUE'"
              @update:model-value="(value) => handleLimitSelect(item.prop, value as string)"
            >
              <SelectTrigger
                v-test-id="`${item.testId}-menu`"
                :reference="limitFieldAnchor(index)"
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
        </VariableScrubInput>
        <ScrubInput
          v-else
          v-bind="testIdAttr(item.testId)"
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
                v-test-id="`${item.testId}-menu`"
                :reference="limitFieldAnchor(index)"
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
