<script setup lang="ts">
import { computed } from 'vue'

import { useI18n } from '@open-pencil/vue/i18n'

import { designModelConnection } from '@/app/ai/models'
import { useCloudCreditBalance } from '@/app/ai/providers/openpencil/balance'
import { OPENPENCIL_AI_PROVIDER } from '@/app/ai/providers/openpencil/provider'
import { cloudBillingURL } from '@/app/cloud/integration'
import { useDateFormat } from '@/app/i18n/date'
import { formatNumber } from '@/app/i18n/number'
import { openExternalLink } from '@/app/shell/ui'
import Tip from '@/components/ui/overlay/Tip.vue'

import { chatProfileTheme } from './ui'

const { replying } = defineProps<{ replying: boolean }>()
const { ai } = useI18n()
const dates = useDateFormat()
const ui = chatProfileTheme()

const { balance, renewsAt } = useCloudCreditBalance({
  workspaceId: () => {
    const connection = designModelConnection.value
    return connection?.providerID === OPENPENCIL_AI_PROVIDER
      ? (connection.cloudWorkspaceId ?? null)
      : null
  },
  replying: () => replying
})

const label = computed(() =>
  balance.value === null ? '' : ai.value.cloudCreditsLeft({ credits: formatNumber(balance.value) })
)
// A Cloud that bills links to its plan; a self-hosted allowance only renews.
const hint = computed(() => {
  if (cloudBillingURL.value) return ai.value.manageCloudPlanAction
  return renewsAt.value
    ? ai.value.cloudCreditsRenew({ date: dates.format(renewsAt.value, 'dayTime') })
    : undefined
})

function openPlan(): void {
  if (cloudBillingURL.value) void openExternalLink(cloudBillingURL.value)
}
</script>

<template>
  <Tip v-if="balance !== null" :label="hint" :disabled="!hint" as-child>
    <button
      v-if="cloudBillingURL"
      type="button"
      :class="ui.trigger({ class: 'shrink-0 cursor-pointer hover:text-surface' })"
      data-test-id="chat-cloud-credits"
      @click="openPlan"
    >
      {{ label }}
    </button>
    <span v-else :class="ui.trigger({ class: 'shrink-0' })" data-test-id="chat-cloud-credits">
      {{ label }}
    </span>
  </Tip>
</template>
