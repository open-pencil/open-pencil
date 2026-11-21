<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { TOKEN_PRESET_NAMES, TOKEN_PRESETS, type TokenPreset } from '@/app/editor/tokens/presets'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const emit = defineEmits<{ load: [preset: TokenPreset] }>()

const { variables } = useI18n()
const options = TOKEN_PRESETS.map((value) => ({ value, label: TOKEN_PRESET_NAMES[value] }))

/** Choosing a theme loads it, so the picker always reads Themes and the same one can load again. */
function choose(value: TokenPreset | '') {
  if (value) emit('load', value)
}
</script>

<template>
  <AppSelect
    model-value=""
    :options="options"
    :label="variables.tokenPreset"
    :display-label="variables.tokenThemes"
    data-test-id="variables-preset-select"
    :ui="{
      trigger:
        'h-7 w-28 border-accent/50 bg-accent/15 text-2xs font-medium text-accent hover:bg-accent/25'
    }"
    @update:model-value="choose"
  >
    <template #leading>
      <icon-lucide-palette class="me-1.5 size-3.5 shrink-0" aria-hidden="true" />
    </template>
  </AppSelect>
</template>
