<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import { useAsyncState } from '@vueuse/core'
import { useRoute } from 'vue-router'

import { queryClient } from '#admin/app/query/client'
import { discoveryQueryOptions } from '#admin/app/query/options'
import PublicShell from '#admin/components/layout/PublicShell.vue'
import { useCloudI18n } from '#admin/i18n/use'
import { createDeviceApprovalService } from './service'

const messages = useCloudI18n()
const route = useRoute()
const userCode = typeof route.query.user_code === 'string' ? route.query.user_code : ''
async function service() {
  return createDeviceApprovalService(await queryClient.ensureQueryData(discoveryQueryOptions()))
}
const { state, isLoading, error, executeImmediate } = useAsyncState(
  async (decision?: 'approve' | 'deny') => {
    const approval = await service()
    return decision ? approval.decide(userCode, decision) : approval.inspect(userCode)
  },
  '',
  { resetOnExecute: false }
)
</script>

<template>
  <PublicShell>
    <main class="mx-auto w-full max-w-md p-5">
      <section class="rounded-xl border border-border bg-panel p-6">
        <h1 class="m-0 text-xl font-semibold">{{ messages.auth.value.deviceTitle }}</h1>
        <p v-if="error" role="alert" class="mt-4 text-sm text-error">
          {{ messages.auth.value.deviceUnavailable }}
        </p>
        <p v-else-if="isLoading" role="status" class="mt-4 text-sm text-muted">
          {{ messages.common.value.loading }}
        </p>
        <template v-else-if="state === 'pending'">
          <p class="mt-4 text-sm text-muted">{{ messages.auth.value.deviceDescription }}</p>
          <p class="my-5 text-center font-mono text-2xl font-semibold">{{ userCode }}</p>
          <div class="flex gap-3">
            <AppButton variant="outline" :disabled="isLoading" @click="executeImmediate('deny')">{{
              messages.admin.value.reject
            }}</AppButton>
            <AppButton
              color="primary"
              variant="solid"
              :disabled="isLoading"
              @click="executeImmediate('approve')"
              >{{ messages.admin.value.approve }}</AppButton
            >
          </div>
        </template>
        <p v-else role="status" class="mt-4 text-sm text-muted">
          {{
            state === 'approved'
              ? messages.auth.value.deviceApproved
              : state === 'denied'
                ? messages.auth.value.deviceDenied
                : messages.auth.value.deviceUnavailable
          }}
        </p>
      </section>
    </main>
  </PublicShell>
</template>
