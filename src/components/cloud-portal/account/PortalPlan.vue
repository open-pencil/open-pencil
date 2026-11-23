<script setup lang="ts">
import { computed } from 'vue'

import { useMessages } from '@open-pencil/vue/i18n'

import { formatNumber } from '@/app/i18n/number'
import { formatStorageBytes } from '@/app/storage/format-bytes'
import SettingsGroup from '@/components/settings/layout/SettingsGroup.vue'
import SettingsRow from '@/components/settings/layout/SettingsRow.vue'
import SettingsSection from '@/components/settings/layout/SettingsSection.vue'
import AppButton from '@/components/ui/button/AppButton.vue'
import AppAlert from '@/components/ui/feedback/AppAlert.vue'
import AppProgress from '@/components/ui/feedback/AppProgress.vue'

import type { PortalPlan } from '../types'

/**
 * The account's plan: what it includes and the storage its workspaces use against it, when Cloud
 * could say. Where the server sells plans, the way to its billing pages, which buy, change, and
 * pay for them. The page names the section above, so the limits take no heading of their own.
 */
const {
  plan,
  sells = false,
  busy = false
} = defineProps<{ plan: PortalPlan | null; sells?: boolean; busy?: boolean }>()
const emit = defineEmits<{ openBilling: [] }>()

const planMessages = useMessages('cloud/portal/plan')

const storageLabel = computed(() => {
  if (!plan) return ''
  const used = formatStorageBytes(plan.storage.usedBytes)
  return plan.storage.totalBytes === null
    ? planMessages.value.planStorageUsed({ used })
    : planMessages.value.planStorageOf({ used, total: formatStorageBytes(plan.storage.totalBytes) })
})
const full = computed(
  () =>
    plan !== null &&
    plan.storage.totalBytes !== null &&
    plan.storage.usedBytes >= plan.storage.totalBytes
)
const credits = computed(() => {
  if (!plan?.services) return planMessages.value.planNoCredits
  if (plan.monthlyCredits === null) return planMessages.value.planUnlimitedCredits
  return planMessages.value.planCredits({ credits: formatNumber(plan.monthlyCredits) })
})
</script>

<template>
  <div class="flex max-w-2xl flex-col gap-6">
    <AppAlert
      v-if="full"
      tone="warning"
      :heading="planMessages.planStorageFull"
      :description="planMessages.planStorageFullDescription"
    />

    <SettingsSection v-if="plan">
      <SettingsGroup>
        <SettingsRow :label="planMessages.planStorage" :description="storageLabel">
          <AppProgress
            v-if="plan.storage.totalBytes !== null"
            :amount="{ value: plan.storage.usedBytes, max: plan.storage.totalBytes }"
            :aria-label="storageLabel"
            :ui="{ root: 'w-32' }"
          />
        </SettingsRow>
        <SettingsRow :label="planMessages.planMonthlyCredits" :description="credits" />
      </SettingsGroup>
    </SettingsSection>

    <SettingsSection v-if="sells">
      <template #title>{{ planMessages.planBilling }}</template>
      <template #description>{{ planMessages.planBillingDescription }}</template>
      <template #actions>
        <AppButton
          size="sm"
          color="primary"
          variant="solid"
          :disabled="busy"
          data-test-id="portal-plan-billing"
          @click="emit('openBilling')"
        >
          {{ planMessages.planOpenBilling }}
          <template #trailing><icon-lucide-arrow-up-right class="size-3.5" /></template>
        </AppButton>
      </template>
    </SettingsSection>
  </div>
</template>
