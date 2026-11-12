<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import type { AIModelCapability, HarnessPermissionMode, ThinkingLevel } from '@/app/ai/models'
import { thinkingLevelOptions as buildThinkingLevelOptions } from '@/app/ai/models/thinking'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import AppSwitch from '@/components/ui/toggle/AppSwitch.vue'

/**
 * What a model can do and how it answers. A model the catalog knows shows its capabilities; one
 * it doesn't takes them from the person.
 */
const {
  detected,
  capabilities,
  outputTokens,
  thinking = false,
  harness = false
} = defineProps<{
  /** The catalog knows the model, so `capabilities` are its and not editable. */
  detected: boolean
  capabilities: AIModelCapability[]
  outputTokens: number
  /** The provider takes a thinking level. */
  thinking?: boolean
  /** The model runs through the Pi companion, which asks which tools it may use. */
  harness?: boolean
}>()
const tools = defineModel<boolean>('tools', { required: true })
const vision = defineModel<boolean>('vision', { required: true })
const thinkingLevel = defineModel<ThinkingLevel>('thinkingLevel', { required: true })
const permissionMode = defineModel<HarnessPermissionMode>('permissionMode', { required: true })

const { ai, common } = useI18n()
const thinkingLevelOptions = computed(() => buildThinkingLevelOptions(ai.value))
const permissionOptions = computed(() => [
  { value: 'allow-reads', label: ai.value.harnessPermissionReads },
  { value: 'allow-edits', label: ai.value.harnessPermissionEdits },
  { value: 'allow-all', label: ai.value.harnessPermissionAll }
])
const support = (capability: AIModelCapability) =>
  capabilities.includes(capability) ? common.value.supported : common.value.unsupported
</script>

<template>
  <SettingsSection>
    <template #title>{{ ai.modelCapabilities }}</template>
    <template #description>{{
      detected ? ai.modelCapabilitiesDetected : ai.modelCapabilitiesManual
    }}</template>
    <SettingsGroup>
      <SettingsRow :as="detected ? 'div' : 'label'" :label="ai.modelCapabilityTools">
        <span v-if="detected" class="text-xs text-surface">{{ support('tools') }}</span>
        <AppSwitch v-else v-model="tools" :label="ai.modelCapabilityTools" />
      </SettingsRow>
      <SettingsRow :as="detected ? 'div' : 'label'" :label="ai.modelCapabilityVision">
        <span v-if="detected" class="text-xs text-surface">{{ support('vision') }}</span>
        <AppSwitch v-else v-model="vision" :label="ai.modelCapabilityVision" />
      </SettingsRow>
      <SettingsRow :label="ai.outputLimit" :description="ai.outputLimitAutomatic">
        <span class="text-xs text-surface tabular-nums"
          >{{ outputTokens.toLocaleString() }} {{ common.tokens }}</span
        >
      </SettingsRow>
    </SettingsGroup>
    <ProviderSettingsField
      v-if="thinking"
      v-slot="{ control }"
      :label="ai.thinkingLevel"
      :hint="ai.thinkingLevelDescription"
    >
      <AppSelect
        v-bind="control"
        v-model="thinkingLevel"
        :label="ai.thinkingLevel"
        :options="thinkingLevelOptions"
      />
    </ProviderSettingsField>
    <ProviderSettingsField v-if="harness" v-slot="{ control }" :label="ai.harnessToolPermissions">
      <AppSelect
        v-bind="control"
        v-model="permissionMode"
        :label="ai.harnessToolPermissions"
        :options="permissionOptions"
      />
    </ProviderSettingsField>
  </SettingsSection>
</template>
