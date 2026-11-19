<script setup lang="ts">
import { onActivated, onBeforeUnmount, onDeactivated, onMounted } from 'vue'
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
 * opens billing again at once. Leaving the page drops a handoff still waiting for its token.
 */
const { entitlements, plan, sells, opening, openBilling, cancelBilling } = usePortalPlan()
const messages = useCloudPortalMessages()
const route = useRoute()
const router = useRouter()

/** Whether the person is on this page, which the automatic handoff checks once it may start. */
let shown = true
function leave() {
  shown = false
  cancelBilling()
}
onActivated(() => {
  shown = true
})
onDeactivated(leave)
onBeforeUnmount(leave)

onMounted(async () => {
  if (route.query.open !== 'billing') return
  await router.replace({ query: {} })
  if (sells && shown) await openBilling()
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
    <!-- Billing stays reachable when the limits can't be read: its own pages show the plan. -->
    <PortalPlan
      v-else
      :plan="plan"
      :sells="sells"
      :busy="opening.busy.value"
      @open-billing="openBilling"
    />
  </div>
</template>
