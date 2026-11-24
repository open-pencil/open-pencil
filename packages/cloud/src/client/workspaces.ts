import type {
  CreatedWorkspaceInvitation,
  CreateWorkspaceInvitationInput,
  WorkspaceEntitlements,
  WorkspaceList,
  WorkspaceMembers,
  WorkspaceRole,
  WorkspaceSummary,
  WorkspaceUsage
} from '#cloud/contract'

import type { CloudContractClient } from './contract'

/** Workspaces, their members, invitations, entitlements, and storage use. */
export function createWorkspaceRequests(
  contract: CloudContractClient['workspaces'],
  documents: CloudContractClient['documents']
) {
  return {
    listWorkspaces(): Promise<WorkspaceList> {
      return contract.list()
    },
    async createWorkspace(name: string): Promise<WorkspaceSummary> {
      return (await contract.create({ body: { name } })).workspace
    },
    async renameWorkspace(workspaceId: string, name: string): Promise<WorkspaceSummary> {
      return (await contract.rename({ params: { workspaceId }, body: { name } })).workspace
    },
    /** Deletes an empty workspace; the server refuses one that still holds documents. */
    async deleteWorkspace(workspaceId: string): Promise<void> {
      await contract.remove({ params: { workspaceId } })
    },
    /** The workspace's members, and for administrators its pending invitations. */
    listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMembers> {
      return contract.members({ params: { workspaceId } })
    },
    inviteToWorkspace(
      workspaceId: string,
      input: CreateWorkspaceInvitationInput
    ): Promise<CreatedWorkspaceInvitation> {
      return contract.invite({ params: { workspaceId }, body: input })
    },
    /** Sends a waiting invitation again; its earlier link stops working. */
    resendWorkspaceInvitation(
      workspaceId: string,
      invitationId: string
    ): Promise<CreatedWorkspaceInvitation> {
      return contract.resendInvitation({ params: { workspaceId, invitationId } })
    },
    async revokeWorkspaceInvitation(workspaceId: string, invitationId: string): Promise<void> {
      await contract.revokeInvitation({ params: { workspaceId, invitationId } })
    },
    async updateWorkspaceMember(
      workspaceId: string,
      userId: string,
      role: WorkspaceRole
    ): Promise<void> {
      await contract.updateMember({ params: { workspaceId, userId }, body: { role } })
    },
    /** Removes someone from the workspace; with the person's own id, leaves it. */
    async removeWorkspaceMember(workspaceId: string, userId: string): Promise<void> {
      await contract.removeMember({ params: { workspaceId, userId } })
    },
    async getWorkspaceEntitlements(workspaceId: string): Promise<WorkspaceEntitlements> {
      return (await contract.entitlements({ params: { workspaceId } })).entitlements
    },
    async getUsage(workspaceId: string): Promise<WorkspaceUsage> {
      return (await documents.usage({ params: { workspaceId } })).usage
    }
  }
}
