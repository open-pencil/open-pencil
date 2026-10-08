<script setup lang="ts">
import {
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRoot,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  PopoverAnchor,
  PopoverContent,
  PopoverPortal,
  PopoverRoot
} from 'reka-ui'
import { computed, ref, type ComponentPublicInstance } from 'vue'

import type { ComponentPropertyType } from '@open-pencil/scene-graph'
import { useComponentPropertyAuthoring, useFlatReorderDrag, useI18n } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import { menuItem, useMenuUI } from '@/components/ui/menu/menu'
import { usePopoverUI } from '@/components/ui/overlay/popover'
import Tip from '@/components/ui/overlay/Tip.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

import PropertyRow from './PropertyRow.vue'
import PropertyTypeIcon from './PropertyTypeIcon.vue'

/** A main component's text, boolean and swap properties, and the nested instances it exposes. */
const authoring = useComponentPropertyAuthoring()
const { context, definitions, nestedInstances, editable } = authoring
const { panels, common } = useI18n()
const menu = useMenuUI({ content: 'min-w-44' })
const item = menuItem({ justify: 'start' })
const nestedOpen = ref(false)
/** Set by the menu item; the popover opens once the menu has closed and returned focus. */
const nestedRequested = ref(false)

function openNestedAfterMenu(event: Event) {
  if (!nestedRequested.value) return
  event.preventDefault()
  nestedRequested.value = false
  nestedOpen.value = true
}
const nestedStyles = usePopoverUI({
  content: 'w-60 max-w-[calc(100vw-1rem)]',
  header: 'flex items-center border-b border-border px-3 py-2',
  body: 'flex max-h-72 flex-col gap-0.5 overflow-y-auto p-1.5'
})

const isComponent = computed(
  () => context.value?.node.type === 'COMPONENT' || context.value?.node.type === 'COMPONENT_SET'
)
const ownDefinitions = computed(() =>
  definitions.value.filter((definition) => definition.ownerId === context.value?.owner.id)
)
const exposed = computed(() => nestedInstances.value.filter((node) => node.exposed))
const NEW_PROPERTIES: { type: ComponentPropertyType; label: () => string }[] = [
  { type: 'TEXT', label: () => panels.value.componentPropertyText },
  { type: 'BOOLEAN', label: () => panels.value.componentPropertyBoolean },
  { type: 'INSTANCE_SWAP', label: () => panels.value.componentPropertySwap }
]

const reorder = useFlatReorderDrag({
  items: () => ownDefinitions.value,
  onMove: (propertyId, index) => {
    if (context.value) authoring.move(context.value.owner.id, propertyId, index)
  }
})

function setupRow(element: Element | ComponentPublicInstance | null, propertyId: string) {
  if (!ownDefinitions.value.some((definition) => definition.id === propertyId)) return
  reorder.setupItem(element instanceof HTMLElement ? element : null, () => ({ id: propertyId }))
}

function dropPosition(propertyId: string) {
  if (reorder.instructionTargetId.value !== propertyId) return undefined
  return reorder.instruction.value?.operation === 'reorder-before' ? 'before' : 'after'
}

function initialValue(type: ComponentPropertyType, name: string) {
  if (type === 'BOOLEAN') return 'true'
  if (type === 'TEXT') return name
  return authoring.swapOptions('').find((option) => !option.disabled)?.value ?? ''
}

/** A new property starts with a unique name and a value its type accepts. */
function addProperty(type: ComponentPropertyType, label: string) {
  const owner = context.value?.owner
  if (!owner) return
  const taken = new Set(definitions.value.map((definition) => definition.name))
  let name = label
  for (let suffix = 2; taken.has(name); suffix++) name = `${label} ${suffix}`
  authoring.create(owner.id, name, type, initialValue(type, name))
}

function valueLabel(type: ComponentPropertyType, value: string) {
  return type === 'INSTANCE_SWAP' ? authoring.componentName(value) : value
}
</script>

<template>
  <PopoverRoot v-if="context && isComponent" v-model:open="nestedOpen">
    <PopoverAnchor as-child>
      <PanelSection
        :key="context.node.id"
        :label="panels.properties"
        data-test-id="component-property-list"
      >
        <template #actions>
          <DropdownMenuRoot>
            <DropdownMenuTrigger as-child>
              <IconButton
                :label="panels.createComponentProperty"
                :disabled="!editable"
                data-property="create-property"
              >
                <icon-lucide-plus class="size-3.5" />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
              <DropdownMenuContent
                side="bottom"
                align="end"
                :side-offset="4"
                :class="menu.content"
                @close-auto-focus="openNestedAfterMenu"
              >
                <DropdownMenuItem
                  v-for="option in NEW_PROPERTIES"
                  :key="option.type"
                  :class="item"
                  :data-property-type="option.type"
                  @select="addProperty(option.type, option.label())"
                >
                  <PropertyTypeIcon :kind="option.type" />
                  {{ option.label() }}
                </DropdownMenuItem>
                <template v-if="nestedInstances.length">
                  <DropdownMenuSeparator :class="menu.separator" />
                  <DropdownMenuItem
                    :class="item"
                    data-property-type="nested"
                    @select="nestedRequested = true"
                  >
                    <icon-lucide-component :class="menu.icon" />
                    {{ panels.nestedInstances }}…
                  </DropdownMenuItem>
                </template>
              </DropdownMenuContent>
            </DropdownMenuPortal>
          </DropdownMenuRoot>
        </template>

        <div v-if="definitions.length" class="-mx-1.5 flex flex-col">
          <div
            v-for="definition in definitions"
            :key="definition.id"
            :ref="(element) => setupRow(element, definition.id)"
            class="relative data-[dragging]:opacity-50"
            :data-dragging="reorder.draggingId.value === definition.id || undefined"
          >
            <div
              v-if="dropPosition(definition.id)"
              class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent"
              :class="dropPosition(definition.id) === 'before' ? 'top-0' : 'bottom-0'"
            />
            <PropertyRow
              :name="definition.name"
              :kind="definition.type"
              :value="definition.defaultValue"
              :value-label="valueLabel(definition.type, definition.defaultValue)"
              :options="
                definition.type === 'INSTANCE_SWAP' ? authoring.swapOptions(definition.id) : []
              "
              :groups="definition.bindingGroups"
              :total-variants="authoring.variantCount.value"
              :disabled="!editable"
              @rename="authoring.rename(definition.ownerId, definition.id, $event)"
              @update="authoring.setDefault(definition.ownerId, definition.id, $event)"
              @remove="authoring.remove(definition.ownerId, definition.id)"
              @select="authoring.select"
              @unbind="
                (binding) =>
                  binding.field !== 'SLOT_CONTENT' &&
                  authoring.bind(binding.nodeId, binding.field, null)
              "
            />
          </div>
        </div>

        <div v-if="exposed.length" class="flex flex-col gap-0.5">
          <span class="text-[11px] text-muted">{{ panels.nestedInstances }}</span>
          <div class="-mx-1.5 flex flex-col">
            <div
              v-for="node in exposed"
              :key="node.id"
              class="group/nested flex h-7 items-center gap-1.5 rounded px-1.5 text-xs hover:bg-hover"
              :data-exposed-instance="node.name"
            >
              <button
                type="button"
                class="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                @click="authoring.select(node.id)"
              >
                <icon-lucide-component class="size-3.5 shrink-0 text-component" />
                <span class="truncate text-surface">{{ node.name }}</span>
              </button>
              <IconButton
                :label="panels.hideNestedInstance({ name: node.name })"
                :disabled="!editable"
                class="opacity-0 group-hover/nested:opacity-100 focus-visible:opacity-100"
                @click="authoring.setExposed(node.id, false)"
              >
                <icon-lucide-minus class="size-3.5" />
              </IconButton>
            </div>
          </div>
        </div>
      </PanelSection>
    </PopoverAnchor>
    <PopoverPortal>
      <PopoverContent
        side="left"
        align="start"
        :side-offset="8"
        :aria-label="panels.nestedInstances"
        :class="nestedStyles.content"
      >
        <div :class="nestedStyles.header">
          <h3 class="text-xs font-semibold text-surface">{{ panels.nestedInstances }}</h3>
          <AppButton :aria-label="common.close" class="ml-auto" @click="nestedOpen = false">
            <icon-lucide-x class="size-3.5" />
          </AppButton>
        </div>
        <div :class="nestedStyles.body">
          <Tip
            v-for="node in nestedInstances"
            :key="node.id"
            :label="panels.nothingToExpose"
            :disabled="node.available"
          >
            <label
              class="flex h-7 items-center gap-2 rounded px-1.5 text-xs text-surface hover:bg-hover data-[disabled]:text-muted data-[disabled]:hover:bg-transparent"
              :data-disabled="!node.available || undefined"
            >
              <AppCheckbox
                :model-value="node.exposed"
                :disabled="!editable || !node.available"
                :ariaLabel="node.name"
                @update:model-value="authoring.setExposed(node.id, $event)"
              />
              <icon-lucide-component class="size-3.5 shrink-0 text-component" />
              <span class="truncate">{{ node.name }}</span>
            </label>
          </Tip>
        </div>
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
