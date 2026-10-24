<script setup lang="ts">
import { computed } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import {
  changeWorkspaceRole,
  deleteWorkspace,
  inviteToWorkspace,
  lastInvitationLink,
  lastResentEmail,
  leaveWorkspace,
  membersBusy,
  membersFailure,
  membersLoading,
  membersOpen,
  membersSelf,
  membersWorkspace,
  removeWorkspaceMember,
  renameWorkspace,
  resendWorkspaceInvitation,
  revokeWorkspaceInvitation,
  workspaceMembers,
  type WorkspaceFailure
} from '@/app/cloud/workspaces/manage'

import CloudWorkspaceMembersDialog from './CloudWorkspaceMembersDialog.vue'

/** The one Members dialog, for whichever workspace Home opened it from. */
const t = useCloudMessages()
const failure = computed(() => {
  const kind = membersFailure.value
  if (!kind) return null
  const words: Record<WorkspaceFailure, string> = {
    'not-empty': t.value.workspaceNotEmpty,
    'cleanup-pending': t.value.workspaceCleanupPending,
    'already-member': t.value.workspaceAlreadyMember,
    'last-admin': t.value.workspaceLastAdmin,
    forbidden: t.value.workspaceForbidden,
    'not-found': t.value.workspaceNotFound,
    unavailable: t.value.workspaceFailed
  }
  return words[kind]
})
</script>

<template>
  <CloudWorkspaceMembersDialog
    v-if="membersWorkspace"
    v-model:open="membersOpen"
    :workspace-name="membersWorkspace.name"
    :can-manage="membersWorkspace.role === 'admin'"
    :self="membersSelf"
    :members="workspaceMembers"
    :loading="membersLoading"
    :busy="membersBusy"
    :failure="failure"
    :invitation-link="lastInvitationLink"
    :resent-email="lastResentEmail"
    @rename="renameWorkspace"
    @invite="inviteToWorkspace"
    @revoke="revokeWorkspaceInvitation"
    @resend="resendWorkspaceInvitation"
    @change-role="changeWorkspaceRole"
    @remove="removeWorkspaceMember"
    @leave="leaveWorkspace"
    @delete="deleteWorkspace"
  />
</template>
