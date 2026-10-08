<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'

import { useI18n, useVariantAuthoring } from '@open-pencil/vue'

import AppInput from '@/components/ui/input/AppInput.vue'
import PanelFieldGroup from '@/components/ui/panel/PanelFieldGroup.vue'
import PanelSection from '@/components/ui/panel/PanelSection.vue'

/**
 * The selected variant's own values. The set's variant properties and their values are edited
 * in the Properties list, and Add variant sits in the panel header.
 */
const { variant, definitions, diagnostics, setVariantValue } = useVariantAuthoring()
const { panels } = useI18n()
const selectedValues = reactive<Record<string, string>>({})
const mutationConflictIds = ref<string[]>([])
const selectedHasConflict = computed(() => {
  const variantId = variant.value?.id
  if (!variantId) return false
  return (
    mutationConflictIds.value.includes(variantId) ||
    diagnostics.value.some((diagnostic) => diagnostic.componentIds.includes(variantId))
  )
})

watch(
  [definitions, variant],
  ([items, selected]) => {
    for (const definition of items) {
      selectedValues[definition.id] =
        selected?.componentPropertyValues[definition.name] ?? definition.values[0] ?? ''
    }
  },
  { immediate: true }
)

function blurInput(event: KeyboardEvent) {
  const target = event.currentTarget
  if (target instanceof HTMLInputElement) target.blur()
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
</script>

<template>
  <PanelSection v-if="variant && definitions.length" :label="panels.variants">
    <div class="flex flex-col gap-1.5">
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
  </PanelSection>
</template>
