type NotificationSocket = ServerWebSocket<{ userId: string }>

export interface NotificationConnectionRegistry {
  addConnection: (userId: string, socket: NotificationSocket) => void
  removeConnection: (userId: string, socket: NotificationSocket) => void
  pushToUser: (userId: string, message: string) => void
  countConnections: (userId: string) => number
}

export function createNotificationConnectionRegistry(): NotificationConnectionRegistry {
  const socketsByUserId = new Map<string, Set<NotificationSocket>>()

  function getSockets(userId: string) {
    let sockets = socketsByUserId.get(userId)
    if (!sockets) {
      sockets = new Set()
      socketsByUserId.set(userId, sockets)
    }
    return sockets
  }

  return {
    addConnection(userId, socket) {
      getSockets(userId).add(socket)
    },
    removeConnection(userId, socket) {
      const sockets = socketsByUserId.get(userId)
      if (!sockets) return
      sockets.delete(socket)
      if (sockets.size === 0) {
        socketsByUserId.delete(userId)
      }
    },
    pushToUser(userId, message) {
      const sockets = socketsByUserId.get(userId)
      if (!sockets) return

      for (const socket of sockets) {
        socket.send(message)
      }
    },
    countConnections(userId) {
      return socketsByUserId.get(userId)?.size ?? 0
    }
  }
}
