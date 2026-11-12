<script setup lang="ts">
import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalPlan } from '@/app/cloud-portal/plan'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPlan from '../account/PortalPlan.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'

/** The signed-in account's plan, with where to buy or manage it; `usePortalPlan` holds the rest. */
const {
  entitlements,
  plan,
  offers,
  creditPacks,
  billingError,
  billingLoading,
  reloadBilling,
  opening,
  subscribe,
  buy,
  manage
} = usePortalPlan()
const messages = useCloudPortalMessages()
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
      v-if="opening.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="opening.error.value"
    />
    <PortalPageSkeleton v-if="entitlements.status.value === 'loading'" :groups="[2]" />
    <PortalPlan
      v-else-if="plan"
      :plan="plan"
      :offers="offers"
      :credit-packs="creditPacks"
      :busy="opening.busy.value"
      @subscribe="subscribe"
      @buy="buy"
      @manage="manage"
    />
  </div>
</template>
