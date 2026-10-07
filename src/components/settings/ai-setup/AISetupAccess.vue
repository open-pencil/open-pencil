<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { ref } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import {
  ONBOARDING_AGENTS,
  ONBOARDING_API_PROVIDERS,
  ONBOARDING_MORE_API_PROVIDERS,
  ONBOARDING_SERVER_PROVIDER,
  type OnboardingAccess
} from '@/app/ai/models/settings/onboarding/plan'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import AppCollapsible from '@/components/ui/collapsible/AppCollapsible.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCheckboxCard from '@/components/ui/toggle/AppCheckboxCard.vue'
import { DESKTOP_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/ai-setup/flow'

const { agentsAvailable } = defineProps<{ agentsAvailable: boolean }>()
const access = defineModel<OnboardingAccess[]>({ required: true })
const { ai } = useI18n()
const styles = tv(theme)()
const moreOpen = ref(
  ONBOARDING_MORE_API_PROVIDERS.some((provider) => access.value.includes(provider))
)

function toggle(providerID: OnboardingAccess, checked: boolean): void {
  access.value = checked
    ? [...access.value, providerID]
    : access.value.filter((candidate) => candidate !== providerID)
}
</script>

<template>
  <section :class="styles.group()">
    <h3 :class="styles.groupHeading()">{{ ai.aiSetupAccessAgents }}</h3>
    <template v-if="agentsAvailable">
      <p :class="styles.help()">{{ ai.aiSetupAccessAgentsDescription }}</p>
      <AppCheckboxCard
        v-for="agent in ONBOARDING_AGENTS"
        :key="agent"
        :label="modelProviderName(agent)"
        :model-value="access.includes(agent)"
        @update:model-value="toggle(agent, $event)"
      >
        <template #icon><ProviderLogo :provider="agent" /></template>
      </AppCheckboxCard>
    </template>
    <AppAlert v-else :heading="ai.aiSetupAccessAgentsDesktop">
      <template #actions>
        <SettingsLink :href="DESKTOP_DOWNLOAD_URL">{{ ai.aiSetupGetDesktop }}</SettingsLink>
      </template>
    </AppAlert>
  </section>
  <section :class="styles.group()">
    <h3 :class="styles.groupHeading()">{{ ai.aiSetupAccessAPI }}</h3>
    <AppCheckboxCard
      v-for="provider in ONBOARDING_API_PROVIDERS"
      :key="provider"
      :label="modelProviderName(provider)"
      :model-value="access.includes(provider)"
      @update:model-value="toggle(provider, $event)"
    >
      <template #icon><ProviderLogo :provider="provider" /></template>
    </AppCheckboxCard>
    <AppCollapsible
      v-model:open="moreOpen"
      :label="ai.aiSetupAccessMore"
      :ui="{ trigger: styles.moreTrigger() }"
    >
      <div :class="styles.moreGroup()">
        <AppCheckboxCard
          v-for="provider in ONBOARDING_MORE_API_PROVIDERS"
          :key="provider"
          :label="modelProviderName(provider)"
          :model-value="access.includes(provider)"
          @update:model-value="toggle(provider, $event)"
        >
          <template #icon><ProviderLogo :provider="provider" /></template>
        </AppCheckboxCard>
      </div>
    </AppCollapsible>
  </section>
  <section :class="styles.group()">
    <AppCheckboxCard
      :label="ai.aiSetupAccessServer"
      :description="ai.aiSetupAccessServerDescription"
      :model-value="access.includes(ONBOARDING_SERVER_PROVIDER)"
      @update:model-value="toggle(ONBOARDING_SERVER_PROVIDER, $event)"
    >
      <template #icon><ProviderLogo :provider="ONBOARDING_SERVER_PROVIDER" /></template>
    </AppCheckboxCard>
  </section>
</template>
