<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { ACP_AGENTS, AI_PROVIDERS } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { modelProviderName } from '@/app/ai/models/provider-name'
import type { AgentSetupState, PiSetupState } from '@/app/ai/models/settings/onboarding/agents'
import {
  ONBOARDING_SERVER_PRESETS,
  type OnboardingConnectionPatch,
  type OnboardingConnectionState
} from '@/app/ai/models/settings/onboarding/connections'
import {
  isOnboardingAgent,
  ONBOARDING_SERVER_PROVIDER,
  type OnboardingAccess
} from '@/app/ai/models/settings/onboarding/plan'
import type { OnboardingSignInStatus } from '@/app/ai/models/settings/onboarding/sign-in'
import ProviderConnectionTestButton from '@/components/chat/ProviderConnectionTestButton.vue'
import ProviderLogo from '@/components/settings/provider/ProviderLogo.vue'
import ProviderSettingsField from '@/components/settings/provider/ProviderSettingsField.vue'
import ProviderSettingsInput from '@/components/settings/provider/ProviderSettingsInput.vue'
import ProviderSettingsKeyField from '@/components/settings/provider/ProviderSettingsKeyField.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import SegmentedControl from '@/components/ui/select/SegmentedControl.vue'
import AppCheckbox from '@/components/ui/toggle/AppCheckbox.vue'
import theme from '@/theme/settings/ai-setup/flow'

import AISetupAgent from './AISetupAgent.vue'
import AISetupPi from './AISetupPi.vue'
import SetupChoice from './SetupChoice.vue'

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
const { ai, common, credentials } = useI18n()
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
const signInFailure = computed(() => {
  if (signInStatus === 'blocked') return ai.value.aiSetupOpenRouterBlocked
  if (signInStatus === 'cancelled') return ai.value.aiSetupOpenRouterCancelled
  if (signInStatus === 'expired') return ai.value.aiSetupOpenRouterExpired
  if (signInStatus === 'failed') return ai.value.aiSetupOpenRouterFailed
  return null
})
const serverPreset = computed(
  () =>
    ONBOARDING_SERVER_PRESETS.find((preset) => preset.baseURL === state.customBaseURL.trim())?.id ??
    'custom'
)
const serverPresetOptions = computed(() => [
  ...ONBOARDING_SERVER_PRESETS.map((preset) => ({ value: preset.id, label: preset.name })),
  { value: 'custom', label: ai.value.aiSetupServerOther }
])

function choosePreset(id: string): void {
  const preset = ONBOARDING_SERVER_PRESETS.find((candidate) => candidate.id === id)
  emit('update', { customBaseURL: preset?.baseURL ?? '' })
}

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

    <AISetupAgent
      v-if="agent && agentSetup"
      :agent="agent"
      :setup="agentSetup"
      @check="emit('checkAgent')"
      @install-agent="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />
    <AISetupPi
      v-else-if="piSetup"
      :setup="piSetup"
      @check="emit('checkAgent')"
      @install-companion="emit('installAgent')"
      @install-bridge="emit('installBridge')"
    />

    <template v-else>
      <p v-if="recommended" :class="styles.help()">{{ ai.aiSetupMeteredNote }}</p>
      <div v-if="state.account" :class="styles.signIn()" data-slot="signed-in">
        <p role="status" :class="styles.signInStatus()">
          <icon-lucide-circle-check :class="styles.signedInIcon()" aria-hidden="true" />
          <span>
            {{ ai.aiSetupOpenRouterSignedInTitle }}
            <span v-if="state.account.label" :class="styles.signInDetail()">
              {{ ai.aiSetupOpenRouterKeyLabel({ label: state.account.label }) }}
            </span>
          </span>
        </p>
        <AppButton size="xs" @click="emit('signOut')">{{ ai.aiSetupOpenRouterChange }}</AppButton>
      </div>
      <AppAlert
        v-if="state.account?.freeTier"
        tone="warning"
        :heading="ai.aiSetupOpenRouterNoCredits"
      />
      <template v-if="supportsSignIn && !state.account">
        <div
          v-if="signInStatus === 'waiting' || signInStatus === 'verifying'"
          :class="styles.signIn()"
        >
          <p role="status" :class="styles.signInStatus()">
            <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
            {{
              signInStatus === 'waiting'
                ? ai.aiSetupOpenRouterWaiting
                : ai.aiSetupOpenRouterVerifying
            }}
          </p>
          <div :class="styles.signInActions()">
            <AppButton
              v-if="signInStatus === 'waiting'"
              size="xs"
              variant="outline"
              @click="emit('reopenSignIn')"
            >
              {{ ai.aiSetupOpenRouterReopen }}
            </AppButton>
            <AppButton size="xs" @click="emit('cancelSignIn')">{{ common.cancel }}</AppButton>
          </div>
        </div>
        <AppButton
          v-else
          class="self-start"
          color="primary"
          variant="solid"
          :disabled="disabled"
          @click="emit('signIn')"
        >
          {{ ai.aiSetupOpenRouterSignIn }}
        </AppButton>
        <AppAlert v-if="signInFailure" tone="warning" :heading="signInFailure" />
        <p :class="styles.groupHeading()">{{ ai.aiSetupOpenRouterOrKey }}</p>
      </template>
      <template v-if="server">
        <SegmentedControl
          :model-value="serverPreset"
          :options="serverPresetOptions"
          :label="ai.aiSetupAccessServer"
          @update:model-value="choosePreset"
        >
          <template #option="{ option }">
            <span class="flex items-center gap-1.5">
              <ProviderLogo :provider="option.value === 'custom' ? providerID : option.value" />
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
        <SetupChoice :label="ai.aiSetupServerVision">
          <AppCheckbox
            :model-value="serverVision"
            :ariaLabel="ai.aiSetupServerVision"
            @update:model-value="emit('serverVision', $event)"
          />
        </SetupChoice>
      </template>
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
