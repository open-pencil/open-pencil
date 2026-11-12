import type { DocumentInvitationEmailPayload, WorkspaceInvitationEmailPayload } from '../schema'
import type { EmailTemplate } from './content'

export const documentInvitation: EmailTemplate<DocumentInvitationEmailPayload> = (
  payload,
  { t, dateTime }
) => {
  const names = { inviter: payload.inviterName ?? t.someone, document: payload.documentName }
  const edit = payload.permission === 'edit'
  const message = edit ? t.documentInvitationEdit(names) : t.documentInvitationView(names)
  return {
    subject: edit ? t.documentInvitationEditSubject(names) : t.documentInvitationViewSubject(names),
    preview: message,
    heading: t.documentInvitationHeading,
    paragraphs: [message],
    action: { label: t.documentInvitationAction, url: payload.acceptanceURL },
    note: { text: t.invitationExpires({ date: dateTime(payload.expiresAt) }) }
  }
}

export const workspaceInvitation: EmailTemplate<WorkspaceInvitationEmailPayload> = (
  payload,
  { t, dateTime }
) => {
  const names = { inviter: payload.inviterName ?? t.someone, workspace: payload.workspaceName }
  const message = {
    admin: t.workspaceInvitationAdmin,
    editor: t.workspaceInvitationEditor,
    viewer: t.workspaceInvitationViewer
  }[payload.role](names)
  return {
    subject: t.workspaceInvitationSubject(names),
    preview: t.workspaceInvitationSubject(names),
    heading: t.workspaceInvitationHeading(names),
    paragraphs: [message, t.workspaceInvitationHome],
    action: { label: t.workspaceInvitationAction, url: payload.acceptanceURL },
    note: { text: t.invitationExpires({ date: dateTime(payload.expiresAt) }) }
  }
}
