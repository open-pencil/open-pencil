<script setup lang="ts">
import { computed } from 'vue'

import { useCloudPortalMessages } from '@open-pencil/vue'

import AppButton from '@/components/ui/button/AppButton.vue'
import { portalList } from '@/theme/cloud-portal/list'

import type { PortalEmail } from '../types'

/** Email the server sends, such as invitations and sign-in links, and whether it went out. */
const { emails, busy = null } = defineProps<{ emails: PortalEmail[]; busy?: string | null }>()
const emit = defineEmits<{ retry: [id: string] }>()

const ui = portalList()
const messages = useCloudPortalMessages()
const tones = {
  sent: 'success',
  waiting: 'neutral',
  failed: 'error',
  suppressed: 'neutral'
} as const
const statusLabels = computed(() => ({
  sent: messages.value.emailSent,
  waiting: messages.value.emailWaiting,
  failed: messages.value.emailFailed,
  suppressed: messages.value.emailSuppressed
}))
const kindLabels = computed<Record<string, string>>(() => ({
  'document-invitation': messages.value.emailKindInvitation,
  'enrollment-requested': messages.value.emailKindEnrollmentRequested,
  'admin-enrollment-notification': messages.value.emailKindAdminNotification,
  'enrollment-approved': messages.value.emailKindEnrollmentApproved,
  'enrollment-rejected': messages.value.emailKindEnrollmentRejected,
  'enrollment-revoked': messages.value.emailKindEnrollmentRevoked,
  'email-verification': messages.value.emailKindVerification,
  'password-reset': messages.value.emailKindPasswordReset,
  'password-changed': messages.value.emailKindPasswordChanged
}))
function detail(email: PortalEmail) {
  const to = messages.value.emailTo({ recipient: email.recipient })
  if (email.error) return `${to} · ${email.error}`
  return email.attempts > 1 ? `${to} · ${messages.value.attempts(email.attempts)}` : to
}
</script>

<template>
  <ul :class="ui.list()">
    <li v-for="email in emails" :key="email.id" :class="ui.row()">
      <icon-lucide-mail class="size-4 shrink-0 text-muted" />
      <div :class="ui.body()">
        <p :class="ui.title()">{{ kindLabels[email.kind] ?? messages.emailKindOther }}</p>
        <p :class="ui.detail()">{{ detail(email) }}</p>
      </div>
      <span :class="ui.status()" :data-tone="tones[email.status]">
        {{ statusLabels[email.status] }}
      </span>
      <span :class="ui.meta()">{{ email.when }}</span>
      <div :class="[ui.actions(), 'w-16 justify-end']">
        <AppButton
          v-if="email.status === 'failed'"
          size="sm"
          variant="outline"
          :loading="busy === email.id"
          @click="emit('retry', email.id)"
        >
          {{ messages.retry }}
        </AppButton>
      </div>
    </li>
  </ul>
</template>
