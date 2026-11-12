<script setup lang="ts">
import { computed } from 'vue'

import { createCloudBillingClient } from '@open-pencil/cloud/client'
import type { BillingAccount, BillingCatalog } from '@open-pencil/cloud/contract'
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortal } from '@/app/cloud-portal/context'
import { usePortalAction, usePortalLoad } from '@/app/cloud-portal/state'
import { createCloudTokenCache } from '@/app/cloud/tokens'
import { useDateFormat } from '@/app/i18n/date'
import { formatNumber, formatPrice } from '@/app/i18n/number'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPlan from '../account/PortalPlan.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'
import type { PortalCreditPack, PortalPlan as Plan, PortalPlanOffer } from '../types'

/**
 * The signed-in account's plan: its entitlements and storage from Cloud, and its subscription and
 * what it can buy from the billing service the server advertises. Buying and managing open the
 * payment provider's own pages.
 */
const portal = usePortal()
const messages = useCloudPortalMessages()
const dates = useDateFormat()

// The route shows this section only when the server advertises billing.
const billing = createCloudBillingClient({
  endpoint: portal.discovery.billing?.endpoint ?? '',
  tokens: createCloudTokenCache(() => portal.api.billingToken()),
  fetch: (input, init) => globalThis.fetch(input, init)
})

const entitlements = usePortalLoad(async () => (await portal.api.entitlements()).entitlements, null)
// What billing knows, read apart: the subscription keeps Manage billing reachable while the
// catalog can't be read, and the plan still shows from Cloud's side when neither can.
const subscription = usePortalLoad(
  async (): Promise<BillingAccount | null> => billing.account(),
  null
)
const catalog = usePortalLoad(async (): Promise<BillingCatalog | null> => billing.catalog(), null)
const billingError = computed(() => subscription.error.value ?? catalog.error.value)
const billingLoading = computed(() => subscription.loading.value || catalog.loading.value)
async function reloadBilling() {
  await Promise.all([subscription.reload(), catalog.reload()])
}

/** Billing sells in US dollars. */
function price(cents: number) {
  return formatPrice(cents, 'USD')
}

const plan = computed<Plan | null>(() => {
  const value = entitlements.data.value
  if (!value) return null
  const account = subscription.data.value
  const current = account?.subscription ?? null
  const name = current
    ? (catalog.data.value?.plans.find((plan) => plan.id === current.planId)?.name ?? current.planId)
    : null
  return {
    known: account !== null,
    name,
    status: current?.status ?? null,
    periodEnd: current ? dates.format(current.currentPeriodEnd, 'date') : null,
    cancels: current?.cancelsAtPeriodEnd ?? false,
    storage: {
      usedBytes: value.usage.committedStorageBytes,
      totalBytes: value.limits.maximumStorageBytes
    },
    monthlyCredits: value.features.cloudServices ? value.limits.monthlyCreditAllowance : null
  }
})
const offers = computed<PortalPlanOffer[]>(() =>
  (catalog.data.value?.plans ?? []).map((offer) => ({
    id: offer.id,
    name: offer.name,
    price: price(offer.monthlyPriceCents),
    storage: formatStorageBytes(offer.storageBytes),
    credits: formatNumber(offer.monthlyCredits)
  }))
)
const creditPacks = computed<PortalCreditPack[]>(() =>
  (catalog.data.value?.creditPacks ?? []).map((pack) => ({
    id: pack.id,
    credits: formatNumber(pack.credits),
    price: price(pack.priceCents),
    validDays: pack.validDays
  }))
)

/** Leaves for the payment provider's page; the plan reads again when the person comes back. */
const open = usePortalAction(async (page: () => Promise<string>) => {
  globalThis.location.assign(await page())
})
</script>

<template>
  <div class="flex flex-col gap-4">
    <PortalLoadAlert
      v-if="entitlements.error.value"
      :error="entitlements.error.value"
      @retry="entitlements.reload()"
    />
    <AppAlert
      v-else-if="billingError"
      tone="warning"
      :heading="messages.billingUnavailable"
      :description="messages.billingUnavailableDescription"
    >
      <template #actions>
        <AppButton size="sm" variant="outline" :disabled="billingLoading" @click="reloadBilling()">
          {{ messages.tryAgain }}
        </AppButton>
      </template>
    </AppAlert>
    <AppAlert
      v-if="open.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="open.error.value"
    />
    <PortalPageSkeleton v-if="entitlements.status.value === 'loading'" :groups="[2]" />
    <PortalPlan
      v-else-if="plan"
      :plan="plan"
      :offers="offers"
      :credit-packs="creditPacks"
      :busy="open.busy.value"
      @subscribe="(planId) => open.run(() => billing.checkout({ planId }))"
      @buy="(creditPackId) => open.run(() => billing.checkout({ creditPackId }))"
      @manage="open.run(() => billing.portal())"
    />
  </div>
</template>
