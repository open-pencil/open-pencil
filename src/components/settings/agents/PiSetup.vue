<script setup lang="ts">
import { tv } from 'tailwind-variants'
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue'

import { piSetupView, type CompanionCheck, type PiSetupState } from '@/app/ai/agents/setup'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppCopyField from '@/components/ui/input/AppCopyField.vue'
import { NODE_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/agents'

import AgentSetupItem from './AgentSetupItem.vue'
import { useSetupProblemMessage } from './problem'

const { setup } = defineProps<{ setup: PiSetupState }>()
const emit = defineEmits<{ check: []; installCompanion: []; installBridge: [] }>()
const { ai, common } = useI18n()
const styles = tv(theme)()
const setupProblemMessage = useSetupProblemMessage()

const view = computed(() => piSetupView(setup))
const problemMessage = computed(() => setupProblemMessage(view.value.problem))

function state(check: CompanionCheck): string {
  if (check.outdated) return ai.value.aiSetupAgentOutdated
  return check.ready ? ai.value.aiSetupAgentInstalled : ai.value.aiSetupAgentNotFound
}

/** The button that installs or updates a companion, while one-click installation can help. */
function actionLabel(
  check: CompanionCheck,
  labels: { install: string; update: string }
): string | undefined {
  if (!check.action) return undefined
  if (check.installing) return ai.value.aiSetupAgentInstalling
  return check.action === 'update' ? labels.update : labels.install
}
</script>

<template>
  <p :class="styles.help()">{{ ai.aiSetupPiDescription }}</p>

  <p v-if="setup.scanning && !setup.checked" role="status" :class="styles.status()">
    <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
    {{ ai.aiSetupAgentChecking }}
  </p>
  <ul v-else :class="styles.list()">
    <AgentSetupItem
      :ready="view.companion.ready"
      :action="
        actionLabel(view.companion, {
          install: ai.aiSetupPiInstallCompanion,
          update: ai.aiSetupPiUpdateCompanion
        })
      "
      :loading="view.companion.installing"
      :disabled="view.busy"
      @action="emit('installCompanion')"
    >
      {{ ai.aiSetupPiCompanion }} · {{ state(view.companion) }}
    </AgentSetupItem>
    <AgentSetupItem
      :ready="view.bridge.ready"
      :action="
        actionLabel(view.bridge, {
          install: ai.aiSetupAgentInstallMCP,
          update: ai.aiSetupAgentUpdateMCP
        })
      "
      :loading="view.bridge.installing"
      :disabled="view.busy"
      @action="emit('installBridge')"
    >
      {{ ai.aiSetupAgentMCP }} · {{ state(view.bridge) }}
    </AgentSetupItem>
    <AgentSetupItem :ready="Boolean(setup.defaultModel)">
      {{
        setup.defaultModel ? ai.aiSetupPiModel({ model: setup.defaultModel }) : ai.aiSetupPiNoModel
      }}
    </AgentSetupItem>
  </ul>
  <AppAlert v-if="problemMessage" tone="warning" :heading="problemMessage">
    <template v-if="view.problem === 'needs-npm'" #actions>
      <SettingsLink :href="NODE_DOWNLOAD_URL">Node.js</SettingsLink>
    </template>
  </AppAlert>

  <template v-if="view.manualCommands.length">
    <p :class="styles.help()">{{ ai.aiSetupAgentInstall }}</p>
    <AppCopyField
      v-for="command in view.manualCommands"
      :key="command"
      :value="command"
      :copy-label="common.copy"
      :copied-label="common.copied"
    />
  </template>

  <p :class="styles.help()">{{ ai.aiSetupPiSignIn }}</p>
  <div :class="styles.actions()">
    <AppButton size="xs" :disabled="view.busy || setup.scanning" @click="emit('check')">
      {{ ai.aiSetupAgentCheckAgain }}
    </AppButton>
  </div>
</template>
