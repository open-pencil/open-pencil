<script setup lang="ts">
import { AppButton, AppInput } from '@open-pencil/ui'
import type { CloudAdminUser } from '@open-pencil/cloud/contract'
import { computed, ref } from 'vue'

import ConfirmDialog from '#admin/components/dialog/ConfirmDialog.vue'
import AsyncBoundary from '#admin/components/feedback/AsyncBoundary.vue'
import EmptyState from '#admin/components/feedback/EmptyState.vue'
import PageHeader from '#admin/components/layout/PageHeader.vue'
import { useCloudI18n } from '#admin/i18n/use'
import UserRow from './UserRow.vue'
import { useUsersAdmin } from './useUsersAdmin'

const messages = useCloudI18n()
const searchInput = ref('')
const search = ref('')
const selected = ref<{ user: CloudAdminUser; action: 'ban' | 'remove-admin' } | null>(null)
const confirmationOpen = computed({
  get: () => selected.value !== null,
  set: (open: boolean) => {
    if (!open) selected.value = null
  }
})
const admin = useUsersAdmin(search)
const labels = computed(() => ({
  makeAdmin: messages.admin.value.makeAdmin,
  removeAdmin: messages.admin.value.removeAdmin,
  revokeSessions: messages.admin.value.revokeSessions,
  ban: messages.admin.value.ban,
  unban: messages.admin.value.unban,
  userRole: messages.common.value.userRole,
  administratorRole: messages.common.value.administratorRole
}))

function rowAction(
  user: CloudAdminUser,
  action: 'ban' | 'unban' | 'revoke-sessions' | 'make-admin' | 'remove-admin'
): void {
  if (action === 'ban' || action === 'remove-admin') {
    selected.value = { user, action }
    return
  }
  if (action === 'make-admin') admin.setAdmin.mutate({ userId: user.id, enabled: true })
  else admin.action.mutate({ action, userId: user.id })
}
function confirm(reason: string | undefined): void {
  if (!selected.value) return
  const selection = selected.value
  const onSuccess = () => (selected.value = null)
  if (selection.action === 'ban') {
    admin.action.mutate({ action: 'ban', userId: selection.user.id, reason }, { onSuccess })
  } else admin.setAdmin.mutate({ userId: selection.user.id, enabled: false }, { onSuccess })
}
</script>

<template>
  <section>
    <PageHeader :title="messages.admin.value.users">
      <form class="flex gap-2" role="search" @submit.prevent="search = searchInput.trim()">
        <AppInput
          v-model="searchInput"
          type="search"
          name="user-search"
          autocomplete="off"
          :aria-label="messages.admin.value.searchUsers"
          :placeholder="messages.admin.value.searchUsers"
        />
        <AppButton type="submit" variant="outline">{{ messages.common.value.search }}</AppButton>
      </form>
    </PageHeader>
    <AsyncBoundary
      :pending="admin.users.isPending.value"
      :error="admin.users.isError.value"
      :loading-label="messages.common.value.loading"
      :error-label="messages.errors.value.network"
      :retry-label="messages.common.value.retry"
      @retry="admin.users.refetch()"
    >
      <EmptyState
        v-if="!admin.users.data.value?.users.length"
        :label="messages.common.value.noResults"
      />
      <div v-else class="grid gap-2">
        <UserRow
          v-for="user in admin.users.data.value.users"
          :key="user.id"
          :user="user"
          :labels="labels"
          :busy="
            (admin.action.isPending.value || admin.setAdmin.isPending.value) &&
            (admin.action.variables.value?.userId === user.id ||
              admin.setAdmin.variables.value?.userId === user.id)
          "
          @action="(action) => rowAction(user, action)"
        />
      </div>
    </AsyncBoundary>
    <ConfirmDialog
      v-model:open="confirmationOpen"
      :title="
        selected?.action === 'ban'
          ? messages.admin.value.banTitle
          : messages.admin.value.removeAdminTitle
      "
      :description="selected?.user.email ?? ''"
      :confirm-label="
        selected?.action === 'ban' ? messages.admin.value.ban : messages.admin.value.removeAdmin
      "
      :cancel-label="messages.common.value.cancel"
      :reason-label="messages.admin.value.confirmationReason"
      :require-reason="selected?.action === 'ban'"
      :loading="admin.action.isPending.value || admin.setAdmin.isPending.value"
      @confirm="confirm"
    />
  </section>
</template>
