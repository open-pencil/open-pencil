<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import type { ACPAgentDef } from '@open-pencil/core/constants'
import { useI18n } from '@open-pencil/vue'

import { codingAgentGuideURL, codingAgentSetupPrompt } from '@/app/ai/acp/setup-prompt'
import { agentSetupView, type AgentSetupState } from '@/app/ai/agents/setup'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import { NODE_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/agents'

import AgentSetupItem from './AgentSetupItem.vue'
import { useSetupProblemMessage } from './problem'

const { agent, setup } = defineProps<{ agent: ACPAgentDef; setup: AgentSetupState }>()
const emit = defineEmits<{ check: []; installAgent: []; installBridge: [] }>()
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

function agentState(): string {
  if (detected.value?.status === 'available') return ai.value.aiSetupAgentInstalled
  if (detected.value?.status === 'needs-adapter') return ai.value.aiSetupAgentNeedsAdapter
  return ai.value.aiSetupAgentNotFound
}
</script>

<template>
  <p :class="styles.help()">{{ ai.aiSetupAgentDescription({ agent: agent.name }) }}</p>

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
    </ul>
    <AppAlert v-if="problemMessage" tone="warning" :heading="problemMessage">
      <template v-if="view.problem === 'needs-npm'" #actions>
        <SettingsLink :href="NODE_DOWNLOAD_URL">Node.js</SettingsLink>
      </template>
    </AppAlert>
  </template>

  <template v-if="view.manualAgentCommand">
    <p :class="styles.help()">{{ ai.aiSetupAgentInstall }}</p>
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
      <template #leading><icon-lucide-clipboard-copy class="size-3" /></template>
      {{ copied ? common.copied : ai.aiSetupAgentCopyPrompt }}
    </AppButton>
    <AppButton
      v-if="setup.supported"
      size="xs"
      :disabled="view.busy || setup.scanning"
      @click="emit('check')"
    >
      {{ ai.aiSetupAgentCheckAgain }}
    </AppButton>
    <SettingsLink :href="codingAgentGuideURL(agent.id)">{{ ai.aiSetupAgentGuide }}</SettingsLink>
  </div>
</template>
