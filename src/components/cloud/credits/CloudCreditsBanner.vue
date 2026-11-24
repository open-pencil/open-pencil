<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import { withQuery } from 'ufo'
import { computed, watch } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

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
const cloud = useMessages('cloud/editor')
const common = useMessages('common')
const dates = useDateFormat()
const { standing, renewsAt, scope, healthy, pays } = useCloudCreditStanding()

const message = computed(() => {
  if (standing.value === 'low') return cloud.value.creditsLowBanner
  return renewsAt.value
    ? cloud.value.creditsOutUntilBanner({ date: dates.format(renewsAt.value, 'date') })
    : cloud.value.creditsOutBanner
})
// Each account and workspace has dismissals of its own. An undated dismissal has no next month
// to end it, so each recovery the wallet confirms starts a new period for it instead.
const recoveries = useLocalStorage<Record<string, number>>(
  'open-pencil:cloud-credits-recoveries',
  {}
)
watch(healthy, (now, before) => {
  if (!now || before || !scope.value) return
  recoveries.value = {
    ...recoveries.value,
    [scope.value]: (recoveries.value[scope.value] ?? 0) + 1
  }
})
const dismissal = computed(() => {
  if (!standing.value || !scope.value) return ''
  const period = renewsAt.value ?? `undated-${recoveries.value[scope.value] ?? 0}`
  return `open-pencil:cloud-credits-${standing.value}:${scope.value}:${period}`
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
