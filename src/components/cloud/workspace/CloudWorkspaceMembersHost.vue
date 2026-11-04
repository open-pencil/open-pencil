<script setup lang="ts">
import { computed, watch } from 'vue'

import { useCloudMessages } from '@open-pencil/vue/i18n'

import {
  changeWorkspaceRole,
  deleteWorkspace,
  inviteToWorkspace,
  lastInvitation,
  lastResent,
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
import { useHeldContent } from '@/components/ui/overlay/held'

import CloudWorkspaceMembersDialog from './CloudWorkspaceMembersDialog.vue'

/** The one Members dialog, for whichever workspace Home opened it from. */
const t = useCloudMessages()
// Leaving or deleting the workspace drops it; the dialog closes and keeps drawing it as it fades.
const workspace = useHeldContent(membersWorkspace)
watch(membersWorkspace, (current) => {
  if (!current) membersOpen.value = false
})
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
    v-if="workspace"
    v-model:open="membersOpen"
    :workspace-name="workspace.name"
    :can-manage="workspace.role === 'admin'"
    :self="membersSelf"
    :members="workspaceMembers"
    :loading="membersLoading"
    :busy="membersBusy"
    :failure="failure"
    :invitation-link="lastInvitation?.link ?? null"
    :resent="lastResent"
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
