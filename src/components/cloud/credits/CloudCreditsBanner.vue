<script setup lang="ts">
import { withQuery } from 'ufo'
import { computed } from 'vue'

import { useCloudMessages, useI18n } from '@open-pencil/vue/i18n'

import { useCloudCreditStanding } from '@/app/ai/providers/openpencil/standing'
import { cloudBillingURL } from '@/app/cloud/integration'
import { useDateFormat } from '@/app/i18n/date'
import { openExternalLink } from '@/app/shell/ui'
import AppBanner from '@/components/ui/feedback/AppBanner.vue'

/**
 * Warns while the AI credits the chat spends on Cloud run low, and once they run out, with the
 * way to buy more where the server bills. Dismissing one lasts until the allowance renews, so the
 * next month warns again, and running out warns even after running low was dismissed.
 */
const cloud = useCloudMessages()
const { common } = useI18n()
const dates = useDateFormat()
const { standing, renewsAt } = useCloudCreditStanding()

const message = computed(() => {
  if (standing.value === 'low') return cloud.value.creditsLowBanner
  return renewsAt.value
    ? cloud.value.creditsOutUntilBanner({ date: dates.format(renewsAt.value, 'date') })
    : cloud.value.creditsOutBanner
})
const dismissal = computed(
  () => `open-pencil:cloud-credits-${standing.value}:${renewsAt.value ?? 'no-allowance'}`
)
// The plan page opens billing at once, where credits are bought.
const buyURL = computed(() =>
  cloudBillingURL.value ? withQuery(cloudBillingURL.value, { open: 'billing' }) : null
)
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
    <template v-if="buyURL" #action>{{ cloud.creditsBuy }}</template>
    <template #dismiss>{{ common.dismiss }}</template>
  </AppBanner>
</template>
