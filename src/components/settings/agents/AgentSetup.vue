<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { ACPAgentDef } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue/i18n'

import { codingAgentGuideURL, codingAgentSetupPrompt } from '@/app/ai/agents/setup/prompt'
import { agentSetupView, type AgentSetupState } from '@/app/ai/agents/setup/view'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import { NODE_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/agents'

import AgentSetupItem from './AgentSetupItem.vue'
import AgentSignInProgress from './AgentSignInProgress.vue'
import { useSetupProblemMessage } from './problem'

const { agent, setup } = defineProps<{ agent: ACPAgentDef; setup: AgentSetupState }>()
const emit = defineEmits<{
  check: []
  installAgent: []
  installBridge: []
  signIn: []
  cancelSignIn: []
  submitSignInCode: [code: string]
}>()
const { ai, common } = useI18n()
const styles = tv(theme)()
const setupProblemMessage = useSetupProblemMessage()
const { copy, copied } = useClipboard({ copiedDuring: 1500 })

const detected = computed(() => setup.detected)
const prompt = computed(() => codingAgentSetupPrompt(agent.id))
const view = computed(() => agentSetupView(agent, setup))
const agentAction = computed(() => {
  if (!view.value.canInstallAdapter) return undefined
  return setup.installingAgent
    ? ai.value.aiSetupAgentInstalling
    : ai.value.aiSetupAgentInstallAdapter
})
const bridgeState = computed(() => {
  if (setup.bridgeOutdated) return ai.value.aiSetupAgentOutdated
  return setup.bridge ? ai.value.aiSetupAgentInstalled : ai.value.aiSetupAgentNotFound
})
const bridgeAction = computed(() => {
  const { action, installing } = view.value.bridge
  if (!action) return undefined
  if (installing) return ai.value.aiSetupAgentInstalling
  return action === 'update' ? ai.value.aiSetupAgentUpdateMCP : ai.value.aiSetupAgentInstallMCP
})
const problemMessage = computed(() => setupProblemMessage(view.value.problem))
const account = computed(() => view.value.account)
const accountState = computed(() => {
  const current = account.value
  if (!current) return ''
  if (current.state === 'signed-in') {
    return [current.label, current.detail].filter((part) => part !== null).join(' · ')
  }
  if (current.state === 'signed-out') return ai.value.aiSetupAgentNotSignedIn
  if (current.state === 'signing-in') return ai.value.aiSetupAgentSigningIn
  if (current.state === 'checking') return ai.value.aiSetupAgentAccountChecking
  return ai.value.aiSetupAgentAccountUnknown
})
const tools = computed(() => account.value?.tools ?? null)
const toolsState = computed(() => {
  const current = tools.value
  if (current?.state === 'connected') return ai.value.aiSetupAgentToolsConnected
  if (current?.state === 'unreachable') return ai.value.aiSetupAgentToolsUnreachable
  return ai.value.aiSetupAgentAccountChecking
})
const accountAction = computed(() =>
  account.value?.canSignIn ? ai.value.aiSetupAgentSignIn : undefined
)

function agentState(): string {
  if (detected.value?.status === 'available') return ai.value.aiSetupAgentInstalled
  // Without the agent's own CLI, the adapter installs the agent too.
  if (detected.value?.status === 'needs-adapter' && detected.value.cliPath) {
    return ai.value.aiSetupAgentNeedsAdapter
  }
  return ai.value.aiSetupAgentNotFound
}
</script>

<template>
  <p :class="styles.help()">
    {{ ai.aiSetupAgentDescription({ agent: agent.name }) }}
    <SettingsLink :href="codingAgentGuideURL(agent.id)">{{ common.learnMore }}</SettingsLink>
  </p>

  <template v-if="setup.supported">
    <p v-if="setup.scanning && !setup.checked" role="status" :class="styles.status()">
      <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
      {{ ai.aiSetupAgentChecking }}
    </p>
    <ul v-else-if="detected" :class="styles.list()">
      <AgentSetupItem
        :ready="detected.status === 'available'"
        :action="agentAction"
        :loading="setup.installingAgent"
        :disabled="view.busy"
        @action="emit('installAgent')"
      >
        {{ agent.name }} · {{ agentState() }}
        <template v-if="detected.status === 'not-installed' && agent.setupURL" #action>
          <SettingsLink :href="agent.setupURL">
            {{ ai.aiSetupAgentGetCLI({ agent: agent.name }) }}
          </SettingsLink>
        </template>
      </AgentSetupItem>
      <AgentSetupItem
        :ready="view.bridge.ready"
        :action="bridgeAction"
        :loading="setup.installingBridge"
        :disabled="view.busy"
        @action="emit('installBridge')"
      >
        {{ ai.aiSetupAgentMCP }} · {{ bridgeState }}
      </AgentSetupItem>
      <AgentSetupItem
        v-if="account"
        :ready="account.state === 'signed-in'"
        :action="accountAction"
        :loading="account.state === 'checking'"
        :disabled="view.busy"
        @action="emit('signIn')"
      >
        {{ ai.aiSetupAgentAccount }} · {{ accountState }}
        <template v-if="account.state === 'signing-in'" #action>
          <AppButton size="xs" variant="outline" @click="emit('cancelSignIn')">
            {{ common.cancel }}
          </AppButton>
        </template>
      </AgentSetupItem>
      <AgentSetupItem v-if="tools" :ready="tools.state === 'connected'">
        {{ ai.aiSetupAgentTools }} · {{ toolsState }}
      </AgentSetupItem>
    </ul>
    <AgentSignInProgress
      v-if="account?.state === 'signing-in'"
      :account="account"
      @submit-code="emit('submitSignInCode', $event)"
    />
    <p v-if="view.canInstallAdapter && agent.installCommand" :class="styles.help()">
      {{ ai.aiSetupAgentInstallRuns({ command: agent.installCommand }) }}
    </p>
    <AppAlert
      v-if="account?.error === 'sign-in'"
      tone="warning"
      :heading="ai.aiSetupAgentSignInFailed({ agent: agent.name })"
    />
    <AppAlert
      v-if="tools?.state === 'unreachable'"
      tone="warning"
      :heading="ai.aiSetupAgentToolsFailed({ agent: agent.name })"
      :description="tools.reason ?? ai.aiSetupAgentToolsHint"
    />
    <AppAlert
      v-if="view.adapterMismatch"
      tone="warning"
      :heading="ai.aiSetupAgentAdapterMismatch({ path: detected?.adapterPath ?? agent.command })"
    />
    <AppAlert v-if="problemMessage" tone="warning" :heading="problemMessage">
      <template v-if="view.problem === 'needs-npm'" #actions>
        <SettingsLink :href="NODE_DOWNLOAD_URL">Node.js</SettingsLink>
      </template>
    </AppAlert>
  </template>

  <template v-if="view.manualAgentCommand">
    <p :class="styles.help()">
      {{ view.adapterMismatch ? ai.aiSetupAgentInstallSupported : ai.aiSetupAgentInstall }}
    </p>
    <AppCopyField
      :value="view.manualAgentCommand"
      :copy-label="common.copy"
      :copied-label="common.copied"
    />
  </template>
  <template v-if="view.manualBridgeCommand">
    <p :class="styles.help()">{{ ai.aiSetupAgentMCPInstall }}</p>
    <AppCopyField
      :value="view.manualBridgeCommand"
      :copy-label="common.copy"
      :copied-label="common.copied"
    />
  </template>

  <p :class="styles.help()">{{ ai.aiSetupAgentPromptHint({ agent: agent.name }) }}</p>
  <div :class="styles.actions()">
    <AppButton size="xs" variant="outline" @click="copy(prompt)">
      <template #leading>
        <icon-lucide-check v-if="copied" class="size-3" />
        <icon-lucide-copy v-else class="size-3" />
      </template>
      {{ copied ? common.copied : ai.aiSetupAgentCopyPrompt }}
    </AppButton>
    <AppButton
      v-if="setup.supported"
      size="xs"
      :disabled="view.busy"
      :loading="setup.scanning || setup.account?.checking"
      @click="emit('check')"
    >
      {{ ai.aiSetupAgentCheckAgain }}
    </AppButton>
  </div>
</template>
