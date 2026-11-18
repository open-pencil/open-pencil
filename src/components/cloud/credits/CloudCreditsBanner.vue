<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { withQuery } from 'ufo'
import { computed, watch } from 'vue'

import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { useCloudCreditStanding } from '@/app/ai/providers/openpencil/standing'
import { cloudBillingURL } from '@/app/cloud/integration'
import { useDateFormat } from '@/app/i18n/date'
import { openExternalLink } from '@/app/shell/ui'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/**
 * Warns while the AI credits the chat spends on Cloud run low, and once they run out, with the
 * way to buy more where the server bills, or to ask the owner in a workspace someone else pays
 * for. Dismissing one lasts until the allowance renews, so the next month warns again, and running
 * out warns even after running low was dismissed. Without a renewal date, a dismissal lasts until
 * the credits recover.
 */
const cloud = useCloudMessages()
const { common } = useI18n()
const dates = useDateFormat()
const { standing, renewsAt, pays } = useCloudCreditStanding()

const message = computed(() => {
  if (standing.value === 'low') return cloud.value.creditsLowBanner
  return renewsAt.value
    ? cloud.value.creditsOutUntilBanner({ date: dates.format(renewsAt.value, 'date') })
    : cloud.value.creditsOutBanner
})
const UNDATED = 'no-allowance'
const dismissalKey = (kind: 'low' | 'out', period: string) =>
  `open-pencil:cloud-credits-${kind}:${period}`
const dismissal = computed(() =>
  standing.value ? dismissalKey(standing.value, renewsAt.value ?? UNDATED) : ''
)
// An undated dismissal has no next month to end it, so credits that recover end it instead.
const undatedDismissals = [
  useLocalStorage(dismissalKey('low', UNDATED), false),
  useLocalStorage(dismissalKey('out', UNDATED), false)
]
watch(standing, (now) => {
  if (now) return
  for (const dismissed of undatedDismissals) dismissed.value = false
})
// The plan page opens billing at once, where credits are bought. Credits come from the owner's
// account, so anyone else is asked to go to the owner instead of buying into their own, and
// neither is offered when the server can't say who owns the workspace.
const buyURL = computed(() =>
  pays.value === true && cloudBillingURL.value
    ? withQuery(cloudBillingURL.value, { open: 'billing' })
    : null
)
const askOwner = computed(() => pays.value === false && cloudBillingURL.value !== null)
</script>

<template>
  <AppBanner
    v-if="standing"
    :key="dismissal"
    :storage-key="dismissal"
    data-test-id="cloud-credits-banner"
    @action="buyURL && openExternalLink(buyURL)"
  >
    {{ message }}
    <template v-if="askOwner">{{ ` ${cloud.creditsAskOwner}` }}</template>
    <template v-if="buyURL" #action>{{ cloud.creditsBuy }}</template>
    <template #dismiss>{{ common.dismiss }}</template>
  </AppBanner>
</template>
