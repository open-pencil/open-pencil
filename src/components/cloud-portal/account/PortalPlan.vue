<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { formatNumber } from '@/app/i18n/number'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppProgress from '@/components/ui/feedback/AppProgress.vue'

import type { PortalCreditPack, PortalPlan, PortalPlanOffer } from '../types'

/**
 * The account's plan: what it includes, the storage its workspaces use against it, and where to
 * subscribe, buy credits, or manage payment. Offers show only to an account without a plan, and
 * credit packs only to one with a plan.
 */
const {
  plan,
  offers = [],
  creditPacks = [],
  busy = false
} = defineProps<{
  plan: PortalPlan
  offers?: PortalPlanOffer[]
  creditPacks?: PortalCreditPack[]
  busy?: boolean
}>()
const emit = defineEmits<{ subscribe: [id: string]; buy: [id: string]; manage: [] }>()

const messages = useCloudPortalMessages()

const subscribed = computed(() => plan.status !== null)
const standing = computed(() => {
  if (!plan.periodEnd) return undefined
  return plan.cancels
    ? messages.value.planEnds({ date: plan.periodEnd })
    : messages.value.planRenews({ date: plan.periodEnd })
})
const storageLabel = computed(() => {
  const used = formatStorageBytes(plan.storage.usedBytes)
  return plan.storage.totalBytes === null
    ? messages.value.planStorageUsed({ used })
    : messages.value.planStorageOf({ used, total: formatStorageBytes(plan.storage.totalBytes) })
})
const full = computed(
  () => plan.storage.totalBytes !== null && plan.storage.usedBytes >= plan.storage.totalBytes
)
const credits = computed(() =>
  plan.monthlyCredits === null
    ? messages.value.planNoCredits
    : messages.value.planCredits({ credits: formatNumber(plan.monthlyCredits) })
)
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <AppAlert
      v-if="plan.status === 'past_due'"
      tone="warning"
      :heading="messages.planPastDue"
      :description="messages.planPastDueDescription"
    />
    <AppAlert
      v-if="full"
      tone="warning"
      :heading="messages.planStorageFull"
      :description="messages.planStorageFullDescription"
    />

    <SettingsSection>
      <template #title>{{ plan.name ?? messages.planFree }}</template>
      <template v-if="standing" #description>{{ standing }}</template>
      <template v-if="subscribed" #actions>
        <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('manage')">
          {{ messages.manageBilling }}
        </AppButton>
      </template>
      <SettingsGroup>
        <SettingsRow :label="messages.planStorage" :description="storageLabel">
          <AppProgress
            v-if="plan.storage.totalBytes !== null"
            :amount="{ value: plan.storage.usedBytes, max: plan.storage.totalBytes }"
            :aria-label="storageLabel"
            :ui="{ root: 'w-32' }"
          />
        </SettingsRow>
        <SettingsRow :label="messages.planMonthlyCredits" :description="credits" />
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="!subscribed && offers.length > 0">
      <template #title>{{ messages.planOffers }}</template>
      <template #description>{{ messages.planOffersDescription }}</template>
      <SettingsGroup>
        <SettingsRow
          v-for="offer in offers"
          :key="offer.id"
          :label="`${offer.name} · ${messages.planOfferPrice({ price: offer.price })}`"
          :description="
            messages.planOfferIncludes({ storage: offer.storage, credits: offer.credits })
          "
        >
          <AppButton size="sm" :disabled="busy" @click="emit('subscribe', offer.id)">
            {{ messages.planSubscribe({ name: offer.name }) }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="subscribed && creditPacks.length > 0">
      <template #title>{{ messages.creditPacks }}</template>
      <template #description>{{ messages.creditPacksDescription }}</template>
      <SettingsGroup>
        <SettingsRow
          v-for="pack in creditPacks"
          :key="pack.id"
          :label="messages.planCredits({ credits: pack.credits })"
          :description="messages.creditPackDetail({ price: pack.price, days: pack.validDays })"
        >
          <AppButton size="sm" variant="outline" :disabled="busy" @click="emit('buy', pack.id)">
            {{ messages.creditPackBuy }}
          </AppButton>
        </SettingsRow>
      </SettingsGroup>
    </SettingsSection>
  </div>
</template>
