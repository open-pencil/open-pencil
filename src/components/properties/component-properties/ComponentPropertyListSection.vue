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
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'

import PropertyRow from './PropertyRow.vue'
import PropertyTypeIcon from './PropertyTypeIcon.vue'
import VariantValueList from './variant/VariantValueList.vue'

/** A main component's text, boolean and swap properties, and the nested instances it exposes. */
const authoring = useComponentPropertyAuthoring()
const { context, definitions, rows, conflicts, componentSet, nestedInstances, editable } = authoring
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
/** Rows the owner holds itself; a variant's own properties keep their place. */
const ownRows = computed(() =>
  rows.value.filter(
    (row) => row.kind === 'variant' || row.property.ownerId === context.value?.owner.id
  )
)
const exposed = computed(() => nestedInstances.value.filter((node) => node.exposed))
const NEW_PROPERTIES: { type: ComponentPropertyType; label: () => string }[] = [
  { type: 'TEXT', label: () => panels.value.componentPropertyText },
  { type: 'BOOLEAN', label: () => panels.value.componentPropertyBoolean },
  { type: 'INSTANCE_SWAP', label: () => panels.value.componentPropertySwap }
]

const reorder = useFlatReorderDrag({
  items: () => ownRows.value,
  onMove: (propertyId, index) => {
    if (context.value) authoring.move(context.value.owner.id, propertyId, index)
  }
})

function setupRow(element: Element | ComponentPublicInstance | null, propertyId: string) {
  if (!ownRows.value.some((row) => row.id === propertyId)) return
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
                <DropdownMenuItem
                  v-if="componentSet"
                  :class="item"
                  data-property-type="VARIANT"
                  @select="authoring.addVariantProperty()"
                >
                  <PropertyTypeIcon kind="VARIANT" />
                  {{ panels.componentPropertyVariant }}
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

        <div
          v-for="conflict in conflicts"
          :key="conflict.label"
          role="alert"
          class="flex items-start gap-1.5 rounded bg-issue-warning/10 px-2 py-1.5 text-[11px] leading-4 text-issue-warning"
        >
          <icon-lucide-triangle-alert class="mt-0.5 size-3 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            {{
              panels.variantsShareValues({
                count: conflict.componentIds.length,
                values: conflict.label
              })
            }}
          </span>
          <button
            type="button"
            class="shrink-0 underline-offset-2 hover:underline"
            @click="authoring.selectNodes(conflict.componentIds)"
          >
            {{ panels.selectVariants }}
          </button>
        </div>

        <div v-if="rows.length" class="-mx-1.5 flex flex-col">
          <div
            v-for="row in rows"
            :key="row.id"
            :ref="(element) => setupRow(element, row.id)"
            class="relative data-[dragging]:opacity-50"
            :data-dragging="reorder.draggingId.value === row.id || undefined"
          >
            <div
              v-if="dropPosition(row.id)"
              class="pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-accent"
              :class="dropPosition(row.id) === 'before' ? 'top-0' : 'bottom-0'"
            />
            <PropertyRow
              v-if="row.kind === 'variant'"
              :name="row.variant.name"
              kind="VARIANT"
              :value="row.variant.values[0] ?? ''"
              :value-label="row.variant.values.join(', ')"
              :disabled="!editable"
              @rename="authoring.renameVariantProperty(row.id, $event)"
              @remove="authoring.removeVariantProperty(row.id)"
            >
              <PanelFieldGroup :label="panels.variantValues">
                <VariantValueList
                  :name="row.variant.name"
                  :values="row.variant.values"
                  :used="row.variant.used"
                  :disabled="!editable"
                  :rename="
                    (previous, value) => authoring.renameVariantValue(row.id, previous, value)
                  "
                  :reorder="(values) => authoring.reorderVariantValues(row.id, values)"
                  :add="(value) => authoring.addVariantValue(row.id, value)"
                  :remove="
                    (value, replacement) => authoring.removeVariantValue(row.id, value, replacement)
                  "
                />
              </PanelFieldGroup>
            </PropertyRow>
            <PropertyRow
              v-else
              :name="row.property.name"
              :kind="row.property.type"
              :value="row.property.defaultValue"
              :value-label="valueLabel(row.property.type, row.property.defaultValue)"
              :options="
                row.property.type === 'INSTANCE_SWAP' ? authoring.swapOptions(row.property.id) : []
              "
              :groups="row.property.bindingGroups"
              :total-variants="authoring.variantCount.value"
              :disabled="!editable"
              @rename="authoring.rename(row.property.ownerId, row.property.id, $event)"
              @update="authoring.setDefault(row.property.ownerId, row.property.id, $event)"
              @remove="authoring.remove(row.property.ownerId, row.property.id)"
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
