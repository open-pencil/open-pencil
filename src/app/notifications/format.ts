import type { NotificationRecord } from '@/app/api/notifications'

export interface NotificationsFormatT {
  invitationTitle: (params: { inviter: string; board: string }) => string
  teamInviteTitle: (params: { inviter: string; team: string }) => string
  mentionTitle: (params: { mentioner: string; board: string }) => string
  invitationBody: (params: { role: string }) => string
  teamInviteBody: (params: { role: string }) => string
}

export function isNotificationUnread(notification: NotificationRecord) {
  return notification.readAt === null
}

export function getNotificationTitle(
  notification: NotificationRecord,
  t: NotificationsFormatT
) {
  switch (notification.type) {
    case 'invitation':
      return t.invitationTitle({
        inviter: notification.payload.inviterDisplayName,
        board: notification.payload.boardName
      })
    case 'team_invite':
      return t.teamInviteTitle({
        inviter: notification.payload.inviterDisplayName,
        team: notification.payload.teamName
      })
    case 'mention':
      return t.mentionTitle({
        mentioner: notification.payload.mentionedByDisplayName,
        board: notification.payload.boardName
      })
  }
}

export function getNotificationBody(
  notification: NotificationRecord,
  t: NotificationsFormatT
) {
  switch (notification.type) {
    case 'invitation':
      return t.invitationBody({ role: notification.payload.role })
    case 'team_invite':
      return t.teamInviteBody({ role: notification.payload.role })
    case 'mention':
      return notification.payload.message
  }
}

export function getNotificationTarget(notification: NotificationRecord) {
  return notification.payload.url
}

export function formatNotificationTime(notification: NotificationRecord) {
  return new Date(notification.createdAt).toLocaleString()
}
