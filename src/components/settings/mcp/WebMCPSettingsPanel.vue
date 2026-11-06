<script setup lang="ts">
import { computed } from 'vue'

import { useAutomationMessages, useCommonMessages } from '@open-pencil/vue/i18n'

import type { WebMCPMode } from '@/app/automation/webmcp/schema'
import type { WebMCPRuntimeState } from '@/app/automation/webmcp/service'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsLink from '@/components/settings/layout/SettingsLink.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppStatus from '@/components/ui/feedback/AppStatus.vue'
import AppSelect from '@/components/ui/select/AppSelect.vue'
import { WEBMCP_DOCS_URL } from '@/constants'

const mode = defineModel<WebMCPMode>({ required: true })
const { state } = defineProps<{ state: WebMCPRuntimeState }>()
const automation = useAutomationMessages()
const common = useCommonMessages()
const options = computed(() => [
  { value: 'off' as const, label: automation.value.accessOff },
  { value: 'inspect' as const, label: automation.value.accessInspect },
  { value: 'edit' as const, label: automation.value.accessEdit }
])
const descriptions = computed(() => ({
  off: automation.value.accessOffDescription,
  inspect: automation.value.accessInspectDescription,
  edit: automation.value.accessEditDescription
}))
const tone = computed(
  () =>
    (
      {
        off: 'info',
        starting: 'info',
        ready: 'success',
        unsupported: 'warning',
        error: 'error'
      } as const
    )[state.status]
)
const detail = computed(() => {
  if (state.error) return state.error
  if (state.status === 'ready') return `${automation.value.tools}: ${state.toolCount}`
  return undefined
})
const statusTone = computed(
  () =>
    (
      {
        off: 'neutral',
        starting: 'pending',
        ready: 'success',
        unsupported: 'neutral',
        error: 'neutral'
      } as const
    )[state.status]
)
/** Unsupported or failed WebMCP is a problem to fix, not a status to read. */
const problem = computed(() => state.status === 'unsupported' || state.status === 'error')
const status = computed(
  () =>
    ({
      off: automation.value.statusStopped,
      starting: automation.value.statusStarting,
      ready: automation.value.statusRunning,
      unsupported: automation.value.webmcpUnsupported,
      error: automation.value.statusError
    })[state.status]
)
</script>

<template>
  <SettingsSection data-slot="webmcp-settings">
    <template #title>WebMCP</template>
    <template #description>
      {{ automation.webmcpDescription }}
      <SettingsLink :href="WEBMCP_DOCS_URL">{{ common.learnMore }}</SettingsLink>
    </template>
    <SettingsGroup>
      <SettingsRow :label="automation.browserAccess" :description="descriptions[mode]">
        <AppSelect v-model="mode" :options="options" :label="automation.browserAccess" />
      </SettingsRow>
      <SettingsRow
        v-if="!problem && state.status !== 'off'"
        :label="automation.status"
        :description="detail"
      >
        <AppStatus :tone="statusTone">{{ status }}</AppStatus>
      </SettingsRow>
    </SettingsGroup>
    <AppAlert
      v-if="problem"
      :tone="tone"
      :heading="state.status === 'error' ? automation.webmcpFailed : status"
      :description="detail"
    />
  </SettingsSection>
</template>
