import { getAuthSession, type InklyAuth } from '../auth/index.js'
import type { NotificationRecord } from '../types.js'
import {
  createNotificationConnectionRegistry,
  type NotificationConnectionRegistry
} from './registry.js'

const NOTIFICATIONS_PATH = '/api/ws/notifications'

export type NotificationSocketData = {
  userId: string
}

type NotificationSocket = ServerWebSocket<NotificationSocketData>

type NotificationPushMessage = {
  type: 'notification.created'
  notification: NotificationRecord
}

export interface NotificationWebSocketServer {
  handleRequest: (request: Request, server: Bun.Server) => Promise<Response | undefined | null>
  open: (socket: NotificationSocket) => void
  close: (socket: NotificationSocket) => void
  pushNotification: (notification: NotificationRecord) => void
  registry: NotificationConnectionRegistry
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' }
  })
}

function serializePushMessage(notification: NotificationRecord): string {
  const message: NotificationPushMessage = {
    type: 'notification.created',
    notification
  }

  return JSON.stringify(message)
}

export function createNotificationWebSocketServer(
  auth: InklyAuth,
  log: (message: string) => void = (message) => process.stderr.write(`${message}\n`)
): NotificationWebSocketServer {
  const registry = createNotificationConnectionRegistry()

  return {
    async handleRequest(request, server) {
      const url = new URL(request.url)
      if (url.pathname !== NOTIFICATIONS_PATH) return null

      const session = await getAuthSession(auth, request)
      if (!session) {
        return json(
          {
            error: {
              code: 'forbidden',
              message: 'Login required'
            }
          },
          403
        )
      }

      const upgraded = server.upgrade<NotificationSocketData>(request, {
        data: { userId: session.user.id }
      })
      if (upgraded) return undefined

      return json(
        {
          error: {
            code: 'upgrade_failed',
            message: 'WebSocket upgrade failed'
          }
        },
        426
      )
    },
    open(socket) {
      registry.addConnection(socket.data.userId, socket)
      log(
        `[inkly-api] notifications connected user=${socket.data.userId} connections=${registry.countConnections(socket.data.userId)}`
      )
    },
    close(socket) {
      registry.removeConnection(socket.data.userId, socket)
      log(
        `[inkly-api] notifications disconnected user=${socket.data.userId} connections=${registry.countConnections(socket.data.userId)}`
      )
    },
    pushNotification(notification) {
      registry.pushToUser(notification.userId, serializePushMessage(notification))
    },
    registry
  }
}
