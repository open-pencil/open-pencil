<script setup lang="ts">
import { computed, useSlots } from 'vue'

import { variableText } from '@open-pencil/scene-graph/variables'
import { useEditor } from '@open-pencil/vue'
import { useI18n } from '@open-pencil/vue/i18n'
import { useBindableValue } from '@open-pencil/vue/primitives/BindableValue'

import PropertyTypeIcon from '@/components/properties/component-properties/PropertyTypeIcon.vue'
import { usePropertyBinding } from '@/components/properties/component-properties/usePropertyBinding'
import AppButton from '@/components/ui/button/AppButton.vue'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppPicker, { type AppPickerItem } from '@/components/ui/select/AppPicker.vue'
import { VARIABLE_TYPE_ICONS } from '@/components/variables/type-icons'

import { BOUND_LAYER_FIELDS, type BoundLayerField } from './fields'

/**
 * The list a layer field binds from, as Figma's: a component layer's properties of the field's
 * type, then the variables the field takes. It opens from its own button, or, for a layer outside
 * a component, from the control the `anchor` slot renders when there is one, such as the eye.
 */
const { nodeId, field } = defineProps<{ nodeId: string; field: BoundLayerField }>()
defineSlots<{ anchor?(props: { open: () => void }): unknown }>()

const PROPERTY = 'property:'

const editor = useEditor()
const slots = useSlots()
const config = BOUND_LAYER_FIELDS[field]
const binding = useBindableValue()
const property = usePropertyBinding(field)
const { panels, common } = useI18n()

const open = computed({
  get: () => binding.open.value,
  set: (value: boolean) => (value ? binding.actions.openPicker() : binding.actions.closePicker())
})

const properties = computed(() => (property.available.value ? property.compatible.value : []))

const heading = computed(() =>
  property.available.value ? panels.value.applyVariableOrProperty : panels.value.applyVariable
)
/** The section's other fields have buttons of their own, so the field's button names its field. */
const buttonLabel = computed(() =>
  property.available.value ? heading.value : panels.value[config.buttonLabel]
)

/** A layer outside a component with an anchor opens the list from it, not from a button. */
const ownButton = computed(() => property.available.value || !slots.anchor)

/** A property the layer follows can only be let go of where properties are editable. */
const lockedToProperty = computed(() => !!property.definition.value && !property.editable.value)

const items = computed<AppPickerItem[]>(() => {
  const group = panels.value.propertiesInComponent({ name: property.ownerName.value ?? '' })
  return [
    ...properties.value.map((definition) => ({
      value: `${PROPERTY}${definition.id}`,
      label: definition.name,
      group,
      disabled: !property.editable.value
    })),
    ...binding.variables.value.map((variable) => ({
      value: variable.id,
      label: variable.name,
      group: binding.provider.collectionName?.(variable),
      disabled: lockedToProperty.value
    }))
  ]
})

const selected = computed(() => {
  const definition = property.definition.value
  return definition ? `${PROPERTY}${definition.id}` : binding.variable.value?.id
})

/** What an item holds now: a property's default, or a variable's value for this layer. */
function valueText(value: string) {
  if (value.startsWith(PROPERTY))
    return properties.value.find((definition) => `${PROPERTY}${definition.id}` === value)
      ?.defaultValue
  return variableText(editor.graph.resolveVariableForNode(nodeId, value))
}

function variableType(value: string) {
  return editor.getVariable(value)?.type
}

/** A layer follows one source at a time, so choosing one lets go of the other in the same step. */
function select(value: string) {
  if (value.startsWith(PROPERTY) ? !property.editable.value : lockedToProperty.value) return
  editor.undo.runBatch(config.undoLabel, () => {
    if (value.startsWith(PROPERTY)) {
      if (binding.state.value !== 'unbound') binding.actions.unbind()
      property.bind(value.slice(PROPERTY.length))
    } else {
      if (property.definition.value) property.bind(null)
      binding.actions.bind(value)
    }
  })
}

function createProperty() {
  open.value = false
  editor.undo.runBatch(config.undoLabel, () => {
    if (binding.state.value !== 'unbound') binding.actions.unbind()
    property.create()
  })
}

function detach() {
  open.value = false
  binding.actions.unbind()
}

function openPicker() {
  open.value = true
}
</script>

<template>
  <slot v-if="ownButton" name="anchor" :open="openPicker" />
  <AppPicker
    v-model:open="open"
    :heading="heading"
    :items="items"
    :selected="selected"
    density="compact"
    side="bottom"
    align="end"
    :search-placeholder="common.search"
    :empty-label="panels.noVariablesFound"
    :close-label="common.close"
    :tooltip="buttonLabel"
    @select="select"
  >
    <template v-if="ownButton" #trigger>
      <IconButton
        :label="buttonLabel"
        :disabled="property.available.value && !property.editable.value"
        :active="open"
      >
        <icon-lucide-diamond-plus class="size-3.5" />
      </IconButton>
    </template>
    <template v-else #anchor>
      <slot name="anchor" :open="openPicker" />
    </template>
    <template #leading="{ item }">
      <PropertyTypeIcon v-if="item.value.startsWith(PROPERTY)" :kind="config.propertyType" />
      <component
        :is="VARIABLE_TYPE_ICONS[variableType(item.value) ?? 'STRING']"
        v-else
        class="size-3.5 shrink-0 text-muted"
        aria-hidden="true"
      />
    </template>
    <template #trailing="{ item }">
      <span class="max-w-20 shrink-0 truncate text-muted">{{ valueText(item.value) }}</span>
    </template>
    <template v-if="binding.state.value !== 'unbound' || property.available.value" #footer>
      <AppButton
        v-if="binding.state.value !== 'unbound'"
        size="xs"
        class="w-full justify-start"
        @click="detach"
      >
        <template #leading><icon-lucide-unlink class="size-3" /></template>
        {{ panels.detachVariable }}
      </AppButton>
      <AppButton
        v-if="property.available.value"
        size="xs"
        class="w-full justify-start"
        :disabled="!property.editable.value"
        @click="createProperty"
      >
        <template #leading><icon-lucide-plus class="size-3" /></template>
        {{ panels.createComponentProperty }}
      </AppButton>
    </template>
  </AppPicker>
</template>
