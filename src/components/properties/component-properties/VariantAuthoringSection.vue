<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { useI18n, useVariantAuthoring } from '@open-pencil/vue'

import AppInput from '@/components/ui/AppInput.vue'
import IconButton from '@/components/ui/IconButton.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

const {
  active,
  variant,
  definitions,
  diagnostics,
  addProperty,
  renameProperty,
  removeProperty,
  reorderProperties,
  renameValue,
  reorderValues,
  setVariantValue,
  addVariant,
  duplicateVariant,
  removeVariant
} = useVariantAuthoring()
const { panels } = useI18n()
const propertyNames = reactive<Record<string, string>>({})
const propertyValues = reactive<Record<string, string>>({})
const selectedValues = reactive<Record<string, string>>({})
const newPropertyName = ref('')
const newPropertyValue = ref('')
const mutationConflictIds = ref<string[]>([])
const conflictIds = computed(
  () =>
    new Set([
      ...diagnostics.value.flatMap((diagnostic) => diagnostic.componentIds),
      ...mutationConflictIds.value
    ])
)
const selectedHasConflict = computed(() => {
  const variantId = variant.value?.id
  return variantId ? conflictIds.value.has(variantId) : false
})

watch(
  definitions,
  (items) => {
    for (const definition of items) {
      propertyNames[definition.id] = definition.name
      for (const value of definition.values) propertyValues[`${definition.id}:${value}`] = value
      selectedValues[definition.id] =
        variant.value?.componentPropertyValues[definition.name] ?? definition.values[0] ?? ''
    }
  },
  { immediate: true }
)
watch(
  variant,
  (selected) => {
    if (!selected) return
    for (const definition of definitions.value) {
      selectedValues[definition.id] =
        selected.componentPropertyValues[definition.name] ?? definition.values[0] ?? ''
    }
  },
  { immediate: true }
)

function blurInput(event: KeyboardEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLInputElement) target.blur()
}

function commitPropertyName(propertyId: string) {
  const name = propertyNames[propertyId]?.trim()
  const definition = definitions.value.find((item) => item.id === propertyId)
  if (!name || !definition || !renameProperty(propertyId, name)) {
    if (definition) propertyNames[propertyId] = definition.name
  }
}

function moveProperty(propertyId: string, offset: -1 | 1) {
  const ids = definitions.value.map((definition) => definition.id)
  const index = ids.indexOf(propertyId)
  const destination = index + offset
  if (index === -1 || destination < 0 || destination >= ids.length) return
  const [moved] = ids.splice(index, 1)
  if (!moved) return
  ids.splice(destination, 0, moved)
  reorderProperties(ids)
}

function moveValue(propertyId: string, value: string, offset: -1 | 1) {
  const definition = definitions.value.find((item) => item.id === propertyId)
  if (!definition) return
  const values = [...definition.values]
  const index = values.indexOf(value)
  const destination = index + offset
  if (index === -1 || destination < 0 || destination >= values.length) return
  const [moved] = values.splice(index, 1)
  if (!moved) return
  values.splice(destination, 0, moved)
  reorderValues(propertyId, values)
}

function commitPropertyValue(propertyId: string, previousValue: string) {
  const key = `${propertyId}:${previousValue}`
  const value = propertyValues[key]?.trim()
  if (!value || !renameValue(propertyId, previousValue, value)) {
    propertyValues[key] = previousValue
  }
}

function commitSelectedValue(propertyId: string) {
  const value = selectedValues[propertyId]?.trim()
  const definition = definitions.value.find((item) => item.id === propertyId)
  if (!value || !definition) return
  const result = setVariantValue(propertyId, value)
  mutationConflictIds.value = result.kind === 'conflict' ? result.componentIds : []
  if (result.kind === 'invalid' || result.kind === 'conflict') {
    selectedValues[propertyId] = variant.value?.componentPropertyValues[definition.name] ?? ''
  }
}

function createProperty() {
  const name = newPropertyName.value.trim()
  const value = newPropertyValue.value.trim()
  if (!name || !value) return
  addProperty(name, value)
  newPropertyName.value = ''
  newPropertyValue.value = ''
}
</script>

<template>
  <PanelSection v-if="active" :label="panels.variants" :empty="definitions.length === 0">
    <template #actions>
      <IconButton
        :label="variant ? panels.duplicateVariant : panels.addVariant"
        @click="variant ? duplicateVariant() : addVariant()"
      >
        <icon-lucide-plus class="size-3.5" />
      </IconButton>
      <IconButton v-if="variant" :label="panels.removeVariant" @click="removeVariant">
        <icon-lucide-trash-2 class="size-3.5" />
      </IconButton>
    </template>

    <div v-if="variant" class="flex flex-col gap-1.5">
      <PanelFieldGroup
        v-for="definition in definitions"
        :key="definition.id"
        :label="definition.name"
      >
        <AppInput
          v-model="selectedValues[definition.id]"
          size="sm"
          tone="panel"
          :state="selectedHasConflict ? 'invalid' : 'idle'"
          :aria-label="definition.name"
          :data-property="definition.id"
          @change="commitSelectedValue(definition.id)"
          @enter="blurInput"
        />
      </PanelFieldGroup>
      <p
        v-if="selectedHasConflict"
        role="alert"
        class="rounded bg-danger/10 px-2 py-1.5 text-[10px] leading-4 text-danger"
      >
        {{ panels.duplicateVariantValues }}. {{ panels.variantConflictHelp }}.
      </p>
    </div>

    <div v-else-if="definitions.length" class="flex flex-col gap-2">
      <div
        v-for="definition in definitions"
        :key="definition.id"
        class="flex flex-col gap-1.5 rounded border border-border p-1.5"
        :data-property="definition.id"
      >
        <div class="flex items-center gap-1">
          <AppInput
            v-model="propertyNames[definition.id]"
            size="sm"
            tone="panel"
            :aria-label="panels.variantPropertyName"
            @change="commitPropertyName(definition.id)"
            @enter="blurInput"
          />
          <IconButton
            :label="panels.moveVariantPropertyUp"
            :disabled="definitions[0]?.id === definition.id"
            @click="moveProperty(definition.id, -1)"
          >
            <icon-lucide-chevron-up class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.moveVariantPropertyDown"
            :disabled="definitions.at(-1)?.id === definition.id"
            @click="moveProperty(definition.id, 1)"
          >
            <icon-lucide-chevron-down class="size-3.5" />
          </IconButton>
          <IconButton :label="panels.removeVariantProperty" @click="removeProperty(definition.id)">
            <icon-lucide-trash-2 class="size-3.5" />
          </IconButton>
        </div>
        <div
          v-for="(value, valueIndex) in definition.values"
          :key="value"
          class="flex items-center gap-1"
        >
          <AppInput
            v-model="propertyValues[`${definition.id}:${value}`]"
            size="sm"
            tone="panel"
            :aria-label="`${definition.name}: ${value}`"
            @change="commitPropertyValue(definition.id, value)"
            @enter="blurInput"
          />
          <IconButton
            :label="panels.moveVariantValueUp"
            :disabled="valueIndex === 0"
            @click="moveValue(definition.id, value, -1)"
          >
            <icon-lucide-chevron-up class="size-3.5" />
          </IconButton>
          <IconButton
            :label="panels.moveVariantValueDown"
            :disabled="valueIndex === definition.values.length - 1"
            @click="moveValue(definition.id, value, 1)"
          >
            <icon-lucide-chevron-down class="size-3.5" />
          </IconButton>
        </div>
      </div>
      <p
        v-if="diagnostics.length"
        role="alert"
        class="rounded bg-danger/10 px-2 py-1.5 text-[10px] leading-4 text-danger"
      >
        {{ panels.duplicateVariantValues }}. {{ panels.variantConflictHelp }}.
      </p>
    </div>

    <p v-else class="py-1 text-[10px] text-muted">{{ panels.noVariantProperties }}</p>

    <form class="mt-2 flex flex-col gap-1.5" @submit.prevent="createProperty">
      <div class="grid grid-cols-2 gap-1">
        <AppInput
          v-model="newPropertyName"
          size="sm"
          tone="panel"
          :placeholder="panels.variantPropertyName"
          :aria-label="panels.variantPropertyName"
        />
        <AppInput
          v-model="newPropertyValue"
          size="sm"
          tone="panel"
          :placeholder="panels.variantPropertyValue"
          :aria-label="panels.variantPropertyValue"
        />
      </div>
      <button
        type="submit"
        class="h-6 rounded bg-hover px-2 text-[10px] text-surface hover:bg-active disabled:opacity-50"
        :disabled="!newPropertyName.trim() || !newPropertyValue.trim()"
      >
        {{ panels.addVariantProperty }}
      </button>
    </form>
  </PanelSection>
</template>
