<script setup lang="ts">
import { compact } from 'es-toolkit/array'
import { computed } from 'vue'

import { providerKind } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import {
  aiModelSettings,
  designModelProfiles,
  modelConnection,
  setModelRoleAssignment
} from '@/app/ai/models'
import type { AIModelProfile, AIModelProfileId } from '@/app/ai/models'
import { profileModelName } from '@/app/ai/models/profile-model-name'
import { modelProviderName } from '@/app/ai/models/provider-name'
import { openSettingsDialog } from '@/app/settings/dialog'
import AppSelect from '@/components/ui/select/AppSelect.vue'

import { chatProfileTheme } from './ui'

const { ai } = useI18n()
const ui = chatProfileTheme()
const selectUI = { content: ui.content(), item: ui.item() }

/** The profile's model and where it runs; an agent profile that names no model leaves it to the agent. */
function profileMetadata(profile: AIModelProfile): string {
  const providerID = modelConnection(profile.connectionId)?.providerID
  const agent = providerID !== undefined && providerKind(providerID) !== 'api'
  return compact([
    profileModelName(profile) || (agent ? ai.value.agentDefaultModel : ''),
    providerID && modelProviderName(providerID)
  ]).join(' · ')
}

/** The profiles the Design role can take, as the shared select lists them. */
const profiles = computed(() =>
  designModelProfiles().map((profile) => ({
    value: profile.id,
    label: profile.name,
    metadata: profileMetadata(profile),
    takesImages: profile.capabilities.includes('vision')
  }))
)
const groups = computed(() => [{ label: ai.value.modelRoleDesign, options: profiles.value }])
function profileOf(id: AIModelProfileId) {
  return profiles.value.find((profile) => profile.value === id)
}

const selectedProfileId = computed({
  get: () => aiModelSettings.value.assignments.design,
  set: (profileId: AIModelProfileId) => setModelRoleAssignment('design', profileId)
})

function manageModels(close: () => void): void {
  close()
  openSettingsDialog('ai')
}
</script>

<template>
  <AppSelect
    v-model="selectedProfileId"
    :label="ai.selectDesignModel"
    :groups="groups"
    :ui="selectUI"
    data-test-id="chat-profile-selector"
  >
    <template #trigger>
      <button type="button" :class="ui.trigger({ class: 'flex items-center' })">
        <icon-lucide-bot :class="ui.triggerIcon()" />
        <span :class="ui.triggerValue()"><slot name="value" /></span>
        <icon-lucide-chevron-down :class="ui.triggerChevron()" aria-hidden="true" />
      </button>
    </template>
    <template #option="{ option }">
      <span :class="ui.text()">
        <span :class="ui.name()">{{ option.label }}</span>
        <span :class="ui.metadata()">{{ profileOf(option.value)?.metadata }}</span>
      </span>
    </template>
    <template #option-end="{ option }">
      <icon-lucide-eye
        v-if="profileOf(option.value)?.takesImages"
        :class="ui.capability()"
        :aria-label="ai.modelCapabilityVision"
      />
    </template>
    <template #footer="{ close }">
      <button type="button" :class="ui.footer()" @click="manageModels(close)">
        <span :class="ui.footerIcon()"><icon-lucide-settings class="size-3" /></span>
        {{ ai.manageModelsAndRoles }}
      </button>
    </template>
  </AppSelect>
</template>
