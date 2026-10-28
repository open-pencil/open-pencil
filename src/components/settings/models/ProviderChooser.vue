<script setup lang="ts">
import { computed } from 'vue'

import { IS_TAURI, type AIProviderID } from '@open-pencil/core/constants'
import { useAIMessages } from '@open-pencil/vue/i18n'

import { aiModelSettings, modelConnection } from '@/app/ai/models'
import { modelProviderName } from '@/app/ai/models/provider-name'
import {
  ONBOARDING_AGENTS,
  ONBOARDING_API_PROVIDERS,
  ONBOARDING_MORE_API_PROVIDERS,
  ONBOARDING_SERVER_PROVIDER,
  ONBOARDING_SUBSCRIPTIONS
} from '@/app/ai/models/settings/onboarding/plan'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { cloudAIAvailable } from '@/app/cloud/integration'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppBadge from '@/components/ui/feedback/AppBadge.vue'
import AppActionRow from '@/components/ui/list/AppActionRow.vue'
import { DESKTOP_DOWNLOAD_URL } from '@/constants'

/**
 * What a new model runs on, chosen before its form, in guided setup's groups: coding agents and
 * subscriptions on the desktop, API accounts, servers, and Cloud's models while it offers them.
 */
const emit = defineEmits<{ choose: [providerID: AIProviderID] }>()
const ai = useAIMessages()

/** Providers a model in the list already runs on; choosing one again adds another model. */
const setUp = computed(
  () =>
    new Set(
      aiModelSettings.value.models.flatMap(
        (model) => modelConnection(model.connectionId)?.providerID ?? []
      )
    )
)

interface Choice {
  id: AIProviderID
  description?: string
}

const groups = computed(() => {
  const groups: { key: string; title: string; description?: string; choices: Choice[] }[] = []
  // Agents run, and subscriptions sign in, on this computer.
  if (IS_TAURI) {
    groups.push(
      {
        key: 'agents',
        title: ai.value.aiSetupAccessAgents,
        description: ai.value.aiSetupAccessAgentsDescription,
        choices: ONBOARDING_AGENTS.map((id) => ({ id }))
      },
      {
        key: 'subscriptions',
        title: ai.value.aiSetupAccessSubscriptions,
        choices: ONBOARDING_SUBSCRIPTIONS.map((id) => ({
          id,
          description: ai.value.aiSetupAccessChatGPT
        }))
      }
    )
  }
  groups.push(
    {
      key: 'api',
      title: ai.value.aiSetupAccessAPI,
      choices: [...ONBOARDING_API_PROVIDERS, ...ONBOARDING_MORE_API_PROVIDERS].map((id) => ({ id }))
    },
    {
      key: 'servers',
      title: ai.value.aiSetupAccessServer,
      choices: [
        { id: ONBOARDING_SERVER_PROVIDER, description: ai.value.aiSetupAccessServerDescription },
        { id: 'anthropic-compatible' }
      ]
    }
  )
  if (cloudAIAvailable.value) {
    groups.push({
      key: 'cloud',
      title: modelProviderName(OPENPENCIL_AI_PROVIDER),
      choices: [{ id: OPENPENCIL_AI_PROVIDER }]
    })
  }
  return groups
})
</script>

<template>
  <div class="flex flex-col gap-6" data-test-id="settings-model-provider-chooser">
    <!-- As guided setup says it: agents and subscriptions come with the desktop app. -->
    <SettingsSection v-if="!IS_TAURI">
      <template #title>{{ ai.aiSetupAccessAgents }}</template>
      <AppAlert :heading="ai.aiSetupAccessAgentsDesktop">
        <template #actions>
          <SettingsLink :href="DESKTOP_DOWNLOAD_URL">{{ ai.aiSetupGetDesktop }}</SettingsLink>
        </template>
      </AppAlert>
    </SettingsSection>
    <SettingsSection v-for="group in groups" :key="group.key">
      <template #title>{{ group.title }}</template>
      <template v-if="group.description" #description>{{ group.description }}</template>
      <div class="flex flex-col gap-1.5">
        <AppActionRow
          v-for="choice in group.choices"
          :key="choice.id"
          :data-provider="choice.id"
          @click="emit('choose', choice.id)"
        >
          <template #leading><ProviderLogo :provider="choice.id" /></template>
          {{ modelProviderName(choice.id) }}
          <template v-if="choice.description" #description>{{ choice.description }}</template>
          <template #trailing>
            <AppBadge v-if="setUp.has(choice.id)" :ui="{ base: 'bg-hover text-surface' }">{{
              ai.modelProviderSetUp
            }}</AppBadge>
            <icon-lucide-chevron-right class="size-3.5" />
          </template>
        </AppActionRow>
      </div>
    </SettingsSection>
  </div>
</template>
