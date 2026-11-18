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

import type { PortalPlan } from '../types'

/**
 * The account's plan: what it includes and the storage its workspaces use against it. Where the
 * server sells plans, the way to its billing pages, which buy, change, and pay for them.
 */
const {
  plan,
  sells = false,
  busy = false
} = defineProps<{ plan: PortalPlan; sells?: boolean; busy?: boolean }>()
const emit = defineEmits<{ openBilling: [] }>()

const messages = useCloudPortalMessages()

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
      v-if="full"
      tone="warning"
      :heading="messages.planStorageFull"
      :description="messages.planStorageFullDescription"
    />

    <SettingsSection>
      <template #title>{{ messages.plan }}</template>
      <template #description>{{ messages.planDescription }}</template>
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

    <SettingsSection v-if="sells">
      <template #title>{{ messages.planBilling }}</template>
      <template #description>{{ messages.planBillingDescription }}</template>
      <template #actions>
        <AppButton
          size="sm"
          color="primary"
          variant="solid"
          :disabled="busy"
          data-test-id="portal-plan-billing"
          @click="emit('openBilling')"
        >
          {{ messages.planOpenBilling }}
          <template #trailing><icon-lucide-arrow-up-right class="size-3.5" /></template>
        </AppButton>
      </template>
    </SettingsSection>
  </div>
</template>
