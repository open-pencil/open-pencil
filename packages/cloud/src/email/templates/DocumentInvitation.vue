<script setup lang="ts">
import type { DocumentInvitationEmailPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

const { payload } = defineProps<{ payload: DocumentInvitationEmailPayload }>()

const { t, dateTime } = useEmailLocalization()
const names = { inviter: payload.inviterName ?? t.someone, document: payload.documentName }
const message =
  payload.permission === 'edit' ? t.documentInvitationEdit(names) : t.documentInvitationView(names)
</script>

<template>
  <BrandEmail
    :preview="message"
    :heading="t.documentInvitationHeading"
    :action="{ label: t.documentInvitationAction, url: payload.acceptanceURL }"
  >
    <EmailText>{{ message }}</EmailText>
    <template #note>{{ t.invitationExpires({ date: dateTime(payload.expiresAt) }) }}</template>
  </BrandEmail>
</template>
