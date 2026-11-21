<script setup lang="ts">
import { useI18n } from '@open-pencil/vue/i18n'

import { TOKEN_PRESET_NAMES, TOKEN_PRESETS, type TokenPreset } from '@/app/editor/tokens/presets'
import IconButton from '@/components/ui/button/IconButton.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'

const emit = defineEmits<{ load: [preset: TokenPreset] }>()

const { variables } = useI18n()
const preset = defineModel<TokenPreset>({ required: true })
const options = TOKEN_PRESETS.map((value) => ({ value, label: TOKEN_PRESET_NAMES[value] }))
</script>

<template>
  <div class="flex items-center gap-1" data-test-id="variables-preset">
    <AppSelect
      v-model="preset"
      :options="options"
      :label="variables.tokenPreset"
      data-test-id="variables-preset-select"
      :ui="{ trigger: 'h-7 w-24 text-2xs' }"
    />
    <IconButton
      :label="variables.loadTokenPreset({ preset: TOKEN_PRESET_NAMES[preset] })"
      data-test-id="variables-preset-load"
      @click="emit('load', preset)"
    >
      <icon-lucide-palette class="size-3.5" />
    </IconButton>
  </div>
</template>
