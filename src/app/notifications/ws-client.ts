import type { NotificationRecord } from '@/app/api/notifications'

type NotificationPushMessage = {
  type: 'notification.created'
  notification: NotificationRecord
}

export interface NotificationsWebSocketClientOptions {
  onConnectedChange?: (connected: boolean) => void
  onNotification?: (notification: NotificationRecord) => void
}

const INITIAL_RECONNECT_DELAY_MS = 1_000
const MAX_RECONNECT_DELAY_MS = 30_000

function buildNotificationsWebSocketUrl() {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${window.location.host}/api/ws/notifications`
}

function isNotificationPushMessage(message: unknown): message is NotificationPushMessage {
  if (!message || typeof message !== 'object') return false
  const candidate = message as Partial<NotificationPushMessage>
  return candidate.type === 'notification.created' && !!candidate.notification
}

export function createNotificationsWebSocketClient(options: NotificationsWebSocketClientOptions = {}) {
  let socket: WebSocket | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let reconnectDelay = INITIAL_RECONNECT_DELAY_MS
  let shouldReconnect = true

  function emitConnectedChange(connected: boolean) {
    options.onConnectedChange?.(connected)
  }

  function clearReconnectTimer() {
    if (!reconnectTimer) return
    clearTimeout(reconnectTimer)
    reconnectTimer = null
  }

  function scheduleReconnect() {
    if (!shouldReconnect || reconnectTimer || typeof window === 'undefined') return

    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connect()
    }, reconnectDelay)
    reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS)
  }

  function cleanupSocket() {
    if (!socket) return
    socket.onopen = null
    socket.onmessage = null
    socket.onerror = null
    socket.onclose = null
    socket = null
  }

  function connect() {
    if (typeof window === 'undefined' || socket) return

    shouldReconnect = true
    const nextSocket = new WebSocket(buildNotificationsWebSocketUrl())
    socket = nextSocket

    nextSocket.onopen = () => {
      reconnectDelay = INITIAL_RECONNECT_DELAY_MS
      emitConnectedChange(true)
    }

    nextSocket.onmessage = (event) => {
      const message = JSON.parse(String(event.data)) as unknown
      if (!isNotificationPushMessage(message)) return
      options.onNotification?.(message.notification)
    }

    nextSocket.onerror = () => {
      nextSocket.close()
    }

    nextSocket.onclose = () => {
      const wasActiveSocket = socket === nextSocket
      cleanupSocket()
      if (wasActiveSocket) {
        emitConnectedChange(false)
        scheduleReconnect()
      }
    }
  }

  function disconnect() {
    shouldReconnect = false
    clearReconnectTimer()
    const activeSocket = socket
    cleanupSocket()
    emitConnectedChange(false)
    activeSocket?.close()
  }

  function reconnect() {
    disconnect()
    shouldReconnect = true
    connect()
  }

  return {
    connect,
    disconnect,
    reconnect
  }
}
