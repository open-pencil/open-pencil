import { computed, ref, shallowRef } from 'vue'

import { CloudAPIError } from '@open-pencil/cloud/client'
import type { WorkspaceMembers, WorkspaceRole } from '@open-pencil/cloud/contract'

import { homeLocation } from '@/app/home/location'

import { findCloudServer, showCloudServerOnHome } from '../servers/store'
import { cloudAPIClient, cloudConnection, refreshCloudConnection } from '../sessions/connection'

/** Why a workspace change did not go through, in terms the dialogs explain. */
export type WorkspaceFailure =
  | 'not-empty'
  | 'cleanup-pending'
  | 'already-member'
  | 'last-admin'
  | 'forbidden'
  | 'not-found'
  | 'unavailable'

function failureOf(error: unknown): WorkspaceFailure {
  if (!(error instanceof CloudAPIError)) return 'unavailable'
  if (error.code === 'not_empty') return 'not-empty'
  if (error.code === 'cleanup_pending') return 'cleanup-pending'
  if (error.code === 'already_member') return 'already-member'
  if (error.code === 'last_admin') return 'last-admin'
  if (error.status === 403) return 'forbidden'
  if (error.status === 404) return 'not-found'
  return 'unavailable'
}

function serverClient(serverId: string) {
  const server = findCloudServer(serverId)
  const discovery = server ? cloudConnection(server.id).discovery : null
  if (!server || !discovery) return null
  return { server, client: cloudAPIClient(server, discovery) }
}

// New workspace

export const newWorkspaceOpen = ref(false)
export const newWorkspaceServerId = ref<string | null>(null)
export const newWorkspaceBusy = ref(false)
export const newWorkspaceFailure = ref<WorkspaceFailure | null>(null)

export function openNewWorkspace(serverId: string): void {
  newWorkspaceServerId.value = serverId
  newWorkspaceFailure.value = null
  newWorkspaceBusy.value = false
  newWorkspaceOpen.value = true
}

/** Creates a workspace the person administers, and shows it on Home. */
export async function createWorkspace(name: string): Promise<void> {
  const target = newWorkspaceServerId.value ? serverClient(newWorkspaceServerId.value) : null
  if (!target || newWorkspaceBusy.value) return
  newWorkspaceBusy.value = true
  newWorkspaceFailure.value = null
  try {
    const workspace = await target.client.createWorkspace(name)
    await refreshCloudConnection(target.server)
    showCloudServerOnHome(target.server.id)
    homeLocation.value = { kind: 'workspace', id: workspace.id }
    newWorkspaceOpen.value = false
  } catch (error) {
    newWorkspaceFailure.value = failureOf(error)
  } finally {
    newWorkspaceBusy.value = false
  }
}

// Members

type MembersTarget = { serverId: string; workspaceId: string }
/** An invitation just sent and the link it carries. */
export type SentInvitation = { invitationId: string; link: string }

export const membersOpen = ref(false)
const membersTarget = shallowRef<MembersTarget | null>(null)
export const workspaceMembers = shallowRef<WorkspaceMembers | null>(null)
export const membersLoading = ref(false)
export const membersBusy = ref(false)
export const membersFailure = ref<WorkspaceFailure | null>(null)
/** The invitation just sent, whose link to pass on when the server sends no email. */
export const lastInvitation = ref<SentInvitation | null>(null)
/** The invitation last sent again and its new link, so its row can say so and offer the link. */
export const lastResent = ref<SentInvitation | null>(null)

/** The workspace the dialog manages, as the server last listed it to this person. */
export const membersWorkspace = computed(() => {
  const target = membersTarget.value
  if (!target) return null
  const workspace = cloudConnection(target.serverId).workspaces.find(
    (entry) => entry.id === target.workspaceId
  )
  return workspace ?? null
})

export const membersSelf = computed(() => {
  const target = membersTarget.value
  return target ? (cloudConnection(target.serverId).account?.id ?? null) : null
})

async function reload(): Promise<void> {
  const target = membersTarget.value
  const context = target ? serverClient(target.serverId) : null
  if (!target || !context) return
  try {
    workspaceMembers.value = await context.client.listWorkspaceMembers(target.workspaceId)
  } catch (error) {
    membersFailure.value = failureOf(error)
  }
}

export async function openWorkspaceMembers(serverId: string, workspaceId: string): Promise<void> {
  membersTarget.value = { serverId, workspaceId }
  workspaceMembers.value = null
  membersFailure.value = null
  lastInvitation.value = null
  lastResent.value = null
  membersOpen.value = true
  membersLoading.value = true
  await reload()
  membersLoading.value = false
}

/** Runs one change to the workspace, then lists it again; false when it was refused. */
async function change(
  action: (context: {
    client: ReturnType<typeof cloudAPIClient>
    workspaceId: string
  }) => Promise<void>
): Promise<boolean> {
  const target = membersTarget.value
  const context = target ? serverClient(target.serverId) : null
  if (!target || !context || membersBusy.value) return false
  membersBusy.value = true
  membersFailure.value = null
  try {
    await action({ client: context.client, workspaceId: target.workspaceId })
    await reload()
    return true
  } catch (error) {
    membersFailure.value = failureOf(error)
    return false
  } finally {
    membersBusy.value = false
  }
}

export function inviteToWorkspace(email: string, role: WorkspaceRole): Promise<boolean> {
  return change(async ({ client, workspaceId }) => {
    const created = await client.inviteToWorkspace(workspaceId, { email, role })
    lastInvitation.value = { invitationId: created.invitation.id, link: created.acceptanceURL }
  })
}

/** Sends an invitation again under a new link; the one sent before stops working. */
export function resendWorkspaceInvitation(invitationId: string): Promise<boolean> {
  return change(async ({ client, workspaceId }) => {
    const resent = await client.resendWorkspaceInvitation(workspaceId, invitationId)
    lastResent.value = { invitationId: resent.invitation.id, link: resent.acceptanceURL }
    // Its earlier link no longer works, so the note under the invite form goes with it.
    if (lastInvitation.value?.invitationId === invitationId) lastInvitation.value = null
  })
}

export function revokeWorkspaceInvitation(invitationId: string): Promise<boolean> {
  return change(({ client, workspaceId }) =>
    client.revokeWorkspaceInvitation(workspaceId, invitationId)
  )
}

export function changeWorkspaceRole(userId: string, role: WorkspaceRole): Promise<boolean> {
  return change(({ client, workspaceId }) =>
    client.updateWorkspaceMember(workspaceId, userId, role)
  )
}

export function removeWorkspaceMember(userId: string): Promise<boolean> {
  return change(({ client, workspaceId }) => client.removeWorkspaceMember(workspaceId, userId))
}

export async function renameWorkspace(name: string): Promise<boolean> {
  const target = membersTarget.value
  const renamed = await change(async ({ client, workspaceId }) => {
    await client.renameWorkspace(workspaceId, name)
  })
  const context = target ? serverClient(target.serverId) : null
  if (renamed && context) await refreshCloudConnection(context.server)
  return renamed
}

/** Deletes an empty workspace; Home goes back to Recent once it is gone. */
export async function deleteWorkspace(): Promise<void> {
  const target = membersTarget.value
  const context = target ? serverClient(target.serverId) : null
  if (!target || !context || membersBusy.value) return
  membersBusy.value = true
  membersFailure.value = null
  try {
    await context.client.deleteWorkspace(target.workspaceId)
    membersOpen.value = false
    await refreshCloudConnection(context.server)
  } catch (error) {
    membersFailure.value = failureOf(error)
  } finally {
    membersBusy.value = false
  }
}

/** Leaves the workspace; Home goes back to Recent once it is gone. */
export async function leaveWorkspace(): Promise<void> {
  const target = membersTarget.value
  const self = membersSelf.value
  const context = target ? serverClient(target.serverId) : null
  if (!target || !self || !context || membersBusy.value) return
  membersBusy.value = true
  membersFailure.value = null
  try {
    await context.client.removeWorkspaceMember(target.workspaceId, self)
    membersOpen.value = false
    await refreshCloudConnection(context.server)
  } catch (error) {
    membersFailure.value = failureOf(error)
  } finally {
    membersBusy.value = false
  }
}
