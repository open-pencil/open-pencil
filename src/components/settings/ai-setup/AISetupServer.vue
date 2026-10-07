<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import {
  ONBOARDING_SERVER_PRESETS,
  serverPresetFor,
  type OnboardingConnectionPatch,
  type OnboardingConnectionState
} from '@/app/ai/models/settings/onboarding/connections'
import { ONBOARDING_SERVER_PROVIDER } from '@/app/ai/models/settings/onboarding/plan'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'

/** A local or company server: a preset or any address, its model, and whether it reads images. */
const { state, vision = false } = defineProps<{
  state: Pick<OnboardingConnectionState, 'customBaseURL' | 'customModelID'>
  vision?: boolean
}>()
const emit = defineEmits<{ update: [patch: OnboardingConnectionPatch]; vision: [value: boolean] }>()
const { ai } = useI18n()

const preset = computed(() => serverPresetFor(state.customBaseURL))
const presetOptions = computed(() => [
  ...ONBOARDING_SERVER_PRESETS.map((candidate) => ({
    value: candidate.id,
    label: candidate.name
  })),
  { value: 'custom', label: ai.value.aiSetupServerOther }
])

function choosePreset(id: string): void {
  const chosen = ONBOARDING_SERVER_PRESETS.find((candidate) => candidate.id === id)
  emit('update', { customBaseURL: chosen?.baseURL ?? '' })
}
</script>

<template>
  <SegmentedControl
    :model-value="preset"
    :options="presetOptions"
    :label="ai.aiSetupAccessServer"
    @update:model-value="choosePreset"
  >
    <template #option="{ option }">
      <span class="flex items-center gap-1.5">
        <ProviderLogo
          :provider="option.value === 'custom' ? ONBOARDING_SERVER_PROVIDER : option.value"
        />
        {{ option.label }}
      </span>
    </template>
  </SegmentedControl>
  <ProviderSettingsField v-slot="{ control }" :label="ai.baseURL">
    <ProviderSettingsInput
      v-bind="control"
      :model-value="state.customBaseURL"
      :aria-label="ai.baseURL"
      :placeholder="ai.baseURLPlaceholder"
      @update:model-value="emit('update', { customBaseURL: String($event) })"
    />
  </ProviderSettingsField>
  <ProviderSettingsField v-slot="{ control }" :label="ai.modelID">
    <ProviderSettingsInput
      v-bind="control"
      :model-value="state.customModelID"
      :aria-label="ai.modelID"
      @update:model-value="emit('update', { customModelID: String($event) })"
    />
  </ProviderSettingsField>
  <AppCheckboxCard
    :label="ai.aiSetupServerVision"
    :model-value="vision"
    @update:model-value="emit('vision', $event)"
  />
</template>
