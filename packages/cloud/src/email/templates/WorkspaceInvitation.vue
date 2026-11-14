<script setup lang="ts">
import type { WorkspaceInvitationEmailPayload } from '../schema'
import BrandEmail from './BrandEmail.vue'
import EmailText from './EmailText.vue'
import { useEmailLocalization } from './localization'

const { payload } = defineProps<{ payload: WorkspaceInvitationEmailPayload }>()

const { t, dateTime } = useEmailLocalization()
const names = { inviter: payload.inviterName ?? t.someone, workspace: payload.workspaceName }
const message = {
  admin: t.workspaceInvitationAdmin,
  editor: t.workspaceInvitationEditor,
  viewer: t.workspaceInvitationViewer
}[payload.role](names)
</script>

<template>
  <BrandEmail
    :preview="t.workspaceInvitationSubject(names)"
    :heading="t.workspaceInvitationHeading(names)"
    :action="{ label: t.workspaceInvitationAction, url: payload.acceptanceURL }"
  >
    <EmailText>{{ message }}</EmailText>
    <EmailText>{{ t.workspaceInvitationHome }}</EmailText>
    <template #note>{{ t.invitationExpires({ date: dateTime(payload.expiresAt) }) }}</template>
  </BrandEmail>
</template>
