<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import type { AgentSetupState, PiSetupState } from '@/app/ai/agents/setup'
import { modelProviderName } from '@/app/ai/models/provider-name'
import {
  serverPresetFor,
  type OnboardingConnectionPatch,
  type OnboardingConnectionState
} from '@/app/ai/models/settings/onboarding/connections'
import {
  isOnboardingAgent,
  ONBOARDING_SERVER_PROVIDER,
  type OnboardingAccess
} from '@/app/ai/models/settings/onboarding/plan'
import type { OnboardingSignInStatus } from '@/app/ai/models/settings/onboarding/sign-in'
import AgentSetup from '@/components/settings/agents/AgentSetup.vue'
import PiSetup from '@/components/settings/agents/PiSetup.vue'
import ProviderConnectionTestButton from '@/components/settings/provider/ProviderConnectionTestButton.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import theme from '@/theme/settings/ai-setup/flow'

import AISetupServer from './AISetupServer.vue'
import AISetupSignIn from './AISetupSignIn.vue'

const {
  providerID,
  state,
  hasSavedKey = false,
  agentSetup,
  piSetup,
  serverVision = false,
  signInStatus = 'idle',
  recommended = false,
  disabled = false
} = defineProps<{
  providerID: OnboardingAccess
  state: OnboardingConnectionState
  /** A key saved for the connection that matches what is entered now. */
  hasSavedKey?: boolean
  /** Whether a coding agent and the MCP server it needs are installed. */
  agentSetup?: AgentSetupState
  /** Whether Pi's companion and the MCP server are installed, and Pi's default model. */
  piSetup?: PiSetupState
  /** The person says the server's model can read images. */
  serverVision?: boolean
  /** Progress of signing in with the provider, for providers that support it. */
  signInStatus?: OnboardingSignInStatus
  /** Suggested for pay-as-you-go rather than chosen by the person. */
  recommended?: boolean
  disabled?: boolean
}>()
const emit = defineEmits<{
  update: [patch: OnboardingConnectionPatch]
  test: []
  signIn: []
  reopenSignIn: []
  cancelSignIn: []
  signOut: []
  serverVision: [value: boolean]
  checkAgent: []
  installAgent: []
  installBridge: []
}>()
const { ai, credentials } = useI18n()
const styles = tv(theme)()

const name = computed(() =>
  providerID === ONBOARDING_SERVER_PROVIDER
    ? ai.value.aiSetupAccessServer
    : modelProviderName(providerID)
)
const agent = computed(() =>
  isOnboardingAgent(providerID)
    ? ACP_AGENTS.find((candidate) => `acp:${candidate.id}` === providerID)
    : undefined
)
const provider = computed(() => AI_PROVIDERS.find((candidate) => candidate.id === providerID))
const server = computed(() => providerID === ONBOARDING_SERVER_PROVIDER)
const supportsSignIn = computed(() => providerID === 'openrouter')
const serverPreset = computed(() => serverPresetFor(state.customBaseURL))

const keyHint = computed(() => {
  if (hasSavedKey) return ai.value.aiSetupSavedKeyHint
  return server.value ? ai.value.aiSetupServerKeyHint : undefined
})
</script>

<template>
  <section :class="styles.connection()" :data-provider="providerID">
    <h3 :class="styles.connectionHeading()">
      <ProviderLogo :provider="serverPreset === 'custom' ? providerID : serverPreset" />
      {{ name }}
    </h3>

    <AgentSetup
      v-if="agent && agentSetup"
      :agent="agent"
      :setup="agentSetup"
      @check="emit('checkAgent')"
      @install-agent="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />
    <PiSetup
      v-else-if="piSetup"
      :setup="piSetup"
      @check="emit('checkAgent')"
      @install-companion="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />

    <template v-else>
      <p v-if="recommended" :class="styles.help()">{{ ai.aiSetupMeteredNote }}</p>
      <AISetupSignIn
        v-if="supportsSignIn"
        :account="state.account"
        :status="signInStatus"
        :disabled="disabled"
        @sign-in="emit('signIn')"
        @reopen="emit('reopenSignIn')"
        @cancel="emit('cancelSignIn')"
        @sign-out="emit('signOut')"
      />
      <AISetupServer
        v-if="server"
        :state="state"
        :vision="serverVision"
        @update="emit('update', $event)"
        @vision="emit('serverVision', $event)"
      />
      <ProviderSettingsKeyField
        v-if="!state.account"
        :model-value="state.apiKey"
        :label="ai.apiKey"
        :saved="false"
        :hint="keyHint"
        kind="api"
        :placeholder="hasSavedKey ? credentials.savedReplace : (provider?.keyPlaceholder ?? '')"
        :key-u-r-l="provider?.keyURL"
        :key-u-r-l-label="credentials.getAPIKey"
        @update:model-value="emit('update', { apiKey: $event })"
      />
      <ProviderConnectionTestButton
        v-if="!state.account"
        :status="state.test"
        :reason="state.reason"
        :disabled="disabled"
        @test="emit('test')"
      />
    </template>
  </section>
</template>
