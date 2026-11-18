<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCloudPortalMessages } from '@open-pencil/vue/i18n'

import { usePortalPlan } from '@/app/cloud-portal/plan'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'

import PortalPlan from '../account/PortalPlan.vue'
import PortalLoadAlert from '../layout/PortalLoadAlert.vue'
import PortalPageSkeleton from '../layout/PortalPageSkeleton.vue'

/**
 * The signed-in account's plan, and the way to billing's own pages; `usePortalPlan` holds the
 * rest. Billing sends someone whose session there ended back here with `?open=billing`, which
 * opens billing again at once.
 */
const { entitlements, plan, sells, opening, openBilling } = usePortalPlan()
const messages = useCloudPortalMessages()
const route = useRoute()
const router = useRouter()

onMounted(async () => {
  if (route.query.open !== 'billing') return
  await router.replace({ query: {} })
  if (sells) await openBilling()
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
      v-if="opening.error.value"
      tone="error"
      :heading="messages.errorTitle"
      :description="opening.error.value"
    />
    <PortalPageSkeleton v-if="entitlements.status.value === 'loading'" :groups="[2]" />
    <PortalPlan
      v-else-if="plan"
      :plan="plan"
      :sells="sells"
      :busy="opening.busy.value"
      @open-billing="openBilling"
    />
  </div>
</template>
