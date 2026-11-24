<script setup lang="ts">
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import {
  agentPairing,
  agentPairingServer,
  startAgentPairing,
  stopAgentPairing
} from '@/app/cloud/pairing/session'
import { agentPairingSetup, agentSignInCommand } from '@/app/cloud/pairing/setup'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppStatus from '@/components/ui/feedback/AppStatus.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'

/**
 * Pairs this window with a coding agent through the Cloud server that serves the editor, without
 * an account: the setup the person gives their agent, whether it is at work, and Disconnect.
 */
const automation = useMessages('automation')
const common = useMessages('common')

const signInCommand = computed(() =>
  agentPairingServer.value?.signIn ? agentSignInCommand(agentPairingServer.value.url) : null
)
const state = computed(() => agentPairing.value)
const setup = computed(() =>
  state.value.status === 'paired' ? agentPairingSetup(state.value.mcpURL, state.value.token) : null
)
const active = computed(
  () => state.value.status === 'paired' || state.value.status === 'connecting'
)
const working = computed(() => state.value.status === 'paired' && state.value.lastCallAt !== null)
</script>

<template>
  <SettingsSection data-test-id="settings-agent-pairing">
    <template #title>{{ automation.agentPairing }}</template>
    <template #description>{{ automation.agentPairingDescription }}</template>
    <template #actions>
      <AppButton
        v-if="active"
        variant="outline"
        data-test-id="settings-agent-pairing-disconnect"
        @click="stopAgentPairing()"
        >{{ automation.agentPairingDisconnect }}</AppButton
      >
      <AppButton
        v-else
        color="primary"
        variant="solid"
        data-test-id="settings-agent-pairing-connect"
        @click="startAgentPairing()"
        >{{ automation.agentPairingConnect }}</AppButton
      >
    </template>
    <SettingsGroup v-if="signInCommand && !active" data-slot="agent-pairing-sign-in">
      <div class="flex flex-col gap-1.5 px-3 py-2.5">
        <p class="text-2xs text-muted">{{ automation.agentPairingSignIn }}</p>
        <AppCopyField
          :value="signInCommand"
          :copy-label="common.copy"
          :copied-label="common.copied"
          :ui="{ value: 'break-normal [overflow-wrap:anywhere]' }"
        />
      </div>
    </SettingsGroup>
    <AppAlert
      v-if="state.status === 'failed'"
      tone="error"
      :heading="automation.agentPairingFailed"
    />
    <SettingsGroup v-if="state.status === 'connecting'">
      <div class="px-3 py-2.5">
        <AppStatus tone="pending">{{ automation.agentPairingConnecting }}</AppStatus>
      </div>
    </SettingsGroup>
    <SettingsGroup v-else-if="setup" data-slot="agent-pairing-setup">
      <div class="px-3 py-2.5">
        <AppStatus :tone="working ? 'success' : 'pending'">{{
          working ? automation.agentPairingWorking : automation.agentPairingWaiting
        }}</AppStatus>
      </div>
      <div class="flex flex-col gap-1.5 px-3 py-2.5">
        <p class="text-2xs text-muted">{{ automation.agentPairingInstructions }}</p>
        <AppCopyField
          :value="setup.instructions"
          :copy-label="common.copy"
          :copied-label="common.copied"
          :ui="{ value: 'whitespace-pre-wrap break-normal [overflow-wrap:anywhere]' }"
        />
        <p class="mt-1.5 text-2xs text-muted">{{ automation.agentPairingClaudeCode }}</p>
        <AppCopyField
          :value="setup.claudeCode"
          :copy-label="common.copy"
          :copied-label="common.copied"
          :ui="{ value: 'break-normal [overflow-wrap:anywhere]' }"
        />
        <p class="mt-1.5 text-2xs text-muted">{{ automation.agentPairingConfig }}</p>
        <AppCopyField
          :value="setup.config"
          :copy-label="common.copy"
          :copied-label="common.copied"
          :ui="{ value: 'whitespace-pre-wrap break-normal [overflow-wrap:anywhere]' }"
        />
      </div>
    </SettingsGroup>
    <p v-if="setup" class="max-w-prose text-2xs leading-relaxed text-muted">
      {{ automation.agentPairingNote }}
    </p>
  </SettingsSection>
</template>
