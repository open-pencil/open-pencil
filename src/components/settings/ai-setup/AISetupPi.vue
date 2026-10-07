<script setup lang="ts">
import { useClipboard } from '@vueuse/core'
import { tv } from 'tailwind-variants'
import { computed, ref, watch } from 'vue'

import { useI18n } from '@open-pencil/vue'

import type { PiSetupState } from '@/app/ai/models/settings/onboarding/agents'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import { NODE_DOWNLOAD_URL } from '@/constants'
import theme from '@/theme/settings/ai-setup/flow'

import SetupInstallItem from './SetupInstallItem.vue'

const { setup } = defineProps<{ setup: PiSetupState }>()
const emit = defineEmits<{ check: []; installCompanion: []; installBridge: [] }>()
const { ai, common } = useI18n()
const styles = tv(theme)()
const { copy, copied, text } = useClipboard({ copiedDuring: 1500 })

/** Keeps showing results during a later check instead of flashing back to a spinner. */
const checked = ref(false)
watch(
  () => setup.scanning,
  (scanning) => {
    if (!scanning) checked.value = true
  },
  { immediate: true }
)

const busy = computed(() => setup.installingCompanion || setup.installingBridge)
const companionReady = computed(() => setup.companion && !setup.companionOutdated)
const bridgeReady = computed(() => setup.bridge && !setup.bridgeOutdated)
const needsNpm = computed(
  () => checked.value && !setup.npm && (!companionReady.value || !bridgeReady.value)
)
/** Manual commands are for where one-click installation cannot help. */
const manualCommands = computed(() => {
  const manual = !setup.npm || setup.error === 'harness-install' || setup.error === 'canvas-install'
  if (!manual) return []
  return [
    ...(companionReady.value ? [] : [setup.companionCommand]),
    ...(bridgeReady.value ? [] : [setup.bridgeCommand])
  ]
})
const errorMessage = computed(() => {
  if (setup.error === 'npm' || needsNpm.value) return ai.value.aiSetupAgentNeedsNpm
  if (setup.error === 'harness-install' || setup.error === 'canvas-install') {
    return ai.value.aiSetupAgentInstallFailed
  }
  if (setup.error === 'canvas-start') return ai.value.aiSetupAgentMCPStartFailed
  if (setup.error === 'lookup') return ai.value.aiSetupAgentLookupFailed
  return null
})

function state(installed: boolean, outdated: boolean): string {
  if (outdated) return ai.value.aiSetupAgentOutdated
  return installed ? ai.value.aiSetupAgentInstalled : ai.value.aiSetupAgentNotFound
}

/** The button that installs or updates a companion, while one-click installation can help. */
function actionLabel(
  ready: boolean,
  installing: boolean,
  outdated: boolean,
  labels: { install: string; update: string }
): string | undefined {
  if (ready || !setup.npm) return undefined
  if (installing) return ai.value.aiSetupAgentInstalling
  return outdated ? labels.update : labels.install
}

function copiedLabel(value: string): string {
  return copied.value && text.value === value ? common.value.copied : common.value.copy
}
</script>

<template>
  <p :class="styles.help()">{{ ai.aiSetupPiDescription }}</p>

  <p v-if="setup.scanning && !checked" role="status" :class="styles.signInStatus()">
    <icon-lucide-loader-2 :class="styles.spinner()" aria-hidden="true" />
    {{ ai.aiSetupAgentChecking }}
  </p>
  <ul v-else :class="styles.installList()">
    <SetupInstallItem
      :ready="companionReady"
      :action="
        actionLabel(companionReady, setup.installingCompanion, setup.companionOutdated, {
          install: ai.aiSetupPiInstallCompanion,
          update: ai.aiSetupPiUpdateCompanion
        })
      "
      :loading="setup.installingCompanion"
      :disabled="busy"
      @action="emit('installCompanion')"
    >
      {{ ai.aiSetupPiCompanion }} · {{ state(setup.companion, setup.companionOutdated) }}
    </SetupInstallItem>
    <SetupInstallItem
      :ready="bridgeReady"
      :action="
        actionLabel(bridgeReady, setup.installingBridge, setup.bridgeOutdated, {
          install: ai.aiSetupAgentInstallMCP,
          update: ai.aiSetupAgentUpdateMCP
        })
      "
      :loading="setup.installingBridge"
      :disabled="busy"
      @action="emit('installBridge')"
    >
      {{ ai.aiSetupAgentMCP }} · {{ state(setup.bridge, setup.bridgeOutdated) }}
    </SetupInstallItem>
    <SetupInstallItem :ready="Boolean(setup.defaultModel)">
      {{
        setup.defaultModel ? ai.aiSetupPiModel({ model: setup.defaultModel }) : ai.aiSetupPiNoModel
      }}
    </SetupInstallItem>
  </ul>
  <AppAlert v-if="errorMessage" tone="warning" :heading="errorMessage">
    <template v-if="setup.error === 'npm' || needsNpm" #actions>
      <SettingsLink :href="NODE_DOWNLOAD_URL">Node.js</SettingsLink>
    </template>
  </AppAlert>

  <template v-if="manualCommands.length">
    <p :class="styles.help()">{{ ai.aiSetupAgentInstall }}</p>
    <div v-for="command in manualCommands" :key="command" :class="styles.command()">
      <code>{{ command }}</code>
      <AppButton size="xs" @click="copy(command)">{{ copiedLabel(command) }}</AppButton>
    </div>
  </template>

  <p :class="styles.help()">{{ ai.aiSetupPiSignIn }}</p>
  <div :class="styles.signInActions()">
    <AppButton size="xs" :disabled="busy || setup.scanning" @click="emit('check')">
      {{ ai.aiSetupAgentCheckAgain }}
    </AppButton>
  </div>
</template>
