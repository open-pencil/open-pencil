<script setup lang="ts">
import { AppButton } from '@open-pencil/ui'
import type { CloudAdminUser } from '@open-pencil/cloud/contract'

const { user, busy, labels } = defineProps<{
  user: CloudAdminUser
  busy: boolean
  labels: {
    makeAdmin: string
    removeAdmin: string
    revokeSessions: string
    ban: string
    unban: string
    userRole: string
    administratorRole: string
  }
}>()
const emit = defineEmits<{
  action: [action: 'ban' | 'unban' | 'revoke-sessions' | 'make-admin' | 'remove-admin']
}>()
</script>

<template>
  <article
    class="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-panel p-4"
  >
    <div class="min-w-0">
      <div class="truncate text-sm font-medium">{{ user.name }}</div>
      <div class="truncate text-xs text-muted">
        {{ user.email }} · {{ user.role === 'admin' ? labels.administratorRole : labels.userRole }}
      </div>
    </div>
    <div class="flex flex-wrap justify-end gap-1">
      <AppButton
        size="xs"
        variant="ghost"
        :disabled="busy"
        @click="emit('action', user.role === 'admin' ? 'remove-admin' : 'make-admin')"
      >
        {{ user.role === 'admin' ? labels.removeAdmin : labels.makeAdmin }}
      </AppButton>
      <AppButton
        size="xs"
        variant="ghost"
        :disabled="busy"
        @click="emit('action', 'revoke-sessions')"
        >{{ labels.revokeSessions }}</AppButton
      >
      <AppButton
        v-if="user.banned"
        size="xs"
        variant="ghost"
        :disabled="busy"
        @click="emit('action', 'unban')"
        >{{ labels.unban }}</AppButton
      >
      <AppButton
        v-else
        color="error"
        variant="soft"
        size="xs"
        :disabled="busy"
        @click="emit('action', 'ban')"
        >{{ labels.ban }}</AppButton
      >
    </div>
  </article>
</template>
