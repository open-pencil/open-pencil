import type { InvitationRole, TeamMemberRole } from '@/app/api/client'
import { apiRequest } from '@/app/api/client'

const NOTIFICATION_API_ENDPOINTS = {
  notifications: '/api/notifications',
  notification: (notificationId: string) => `/api/notifications/${notificationId}`,
  read: (notificationId: string) => `/api/notifications/${notificationId}/read`,
  readAll: '/api/notifications/read-all',
  mention: '/api/notifications/mention'
} as const

export type NotificationType = 'invitation' | 'team_invite' | 'mention'

export interface InvitationNotificationPayload {
  invitationId: string
  boardId: string
  boardName: string
  role: InvitationRole
  inviterDisplayName: string
  inviteeEmail: string
  url: string
}

export interface TeamInviteNotificationPayload {
  teamId: string
  teamName: string
  role: Exclude<TeamMemberRole, 'owner'>
  inviterDisplayName: string
  inviteeEmail: string
  url: string
}

export interface MentionNotificationPayload {
  boardId: string
  boardName: string
  mentionedByDisplayName: string
  message: string
  url: string
}

export type NotificationPayload =
  | InvitationNotificationPayload
  | TeamInviteNotificationPayload
  | MentionNotificationPayload

interface NotificationRecordBase<TType extends NotificationType, TPayload extends NotificationPayload> {
  id: string
  userId: string
  type: TType
  payload: TPayload
  readAt: number | null
  createdAt: number
}

export type NotificationRecord =
  | NotificationRecordBase<'invitation', InvitationNotificationPayload>
  | NotificationRecordBase<'team_invite', TeamInviteNotificationPayload>
  | NotificationRecordBase<'mention', MentionNotificationPayload>

export interface CreateMentionNotificationInput {
  boardId: string
  mentionedUserId: string
  sourceUserId: string
  text: string
}

export function listNotifications() {
  return apiRequest<{ notifications: NotificationRecord[] }>(NOTIFICATION_API_ENDPOINTS.notifications).then(
    (response) => response.notifications
  )
}

export function markNotificationRead(notificationId: string) {
  return apiRequest<{ notification: NotificationRecord }>(NOTIFICATION_API_ENDPOINTS.read(notificationId), {
    method: 'POST'
  }).then((response) => response.notification)
}

export function markAllNotificationsRead() {
  return apiRequest<{ updatedCount: number }>(NOTIFICATION_API_ENDPOINTS.readAll, {
    method: 'POST'
  })
}

export function deleteNotification(notificationId: string) {
  return apiRequest<{ deleted: boolean; notification: NotificationRecord }>(
    NOTIFICATION_API_ENDPOINTS.notification(notificationId),
    {
      method: 'DELETE'
    }
  )
}

export function createMentionNotification(input: CreateMentionNotificationInput) {
  return apiRequest<{ notification: NotificationRecord }>(NOTIFICATION_API_ENDPOINTS.mention, {
    method: 'POST',
    body: JSON.stringify(input)
  }).then((response) => response.notification)
}
