import type { ServerWebSocket } from 'bun'

import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'

import { createInklyAuth, type InklyAuth } from './auth/index.js'
import { createBoardStore } from './boardStore.js'
import { resolveApiDatabaseOptions, type ApiDatabase } from './db/client.js'
import { createMigratedApiDatabase } from './db/migrate.js'
import {
  createNotificationStore,
  DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS
} from './notificationStore.js'
import { createAuthRoutes } from './routes/auth.js'
import { createBoardRoutes } from './routes/boards.js'
import { createInviteRoutes } from './routes/invite.js'
import { createNotificationRoutes } from './routes/notifications.js'
import { createTestingRoutes } from './routes/testing.js'
import { createTeamRoutes } from './routes/teams.js'
import { createInvitationStore } from './store.js'
import { createTeamStore } from './teamStore.js'
import { resolveJwtSecret } from './token.js'
import type {
  BoardStore,
  InvitationStore,
  NotificationRecord,
  NotificationStore,
  TeamStore
} from './types.js'
import {
  createNotificationWebSocketServer,
  type NotificationSocketData
} from './ws/notifications.js'
import { createSignalingServer, type SignalingPeerData } from './ws/signaling.js'

export const API_HOST = '127.0.0.1'
export const API_PORT = 3001
const AUTO_SWEEP_INTERVAL_MS = 24 * 3600 * 1000
const EPHEMERAL_PORT_START = 12_000 + (process.pid % 1_000) * 10
let nextEphemeralPort = EPHEMERAL_PORT_START

export interface CreateApiAppOptions {
  secret: string
  store?: InvitationStore
  boardStore?: BoardStore
  teamStore?: TeamStore
  notificationStore?: NotificationStore
  database?: ApiDatabase
  auth?: InklyAuth
  env?: NodeJS.ProcessEnv
  now?: () => number
  onNotificationCreated?: (notification: NotificationRecord) => void
}

export interface StartApiServerOptions extends CreateApiAppOptions {
  port?: number
  host?: string
}

function pickEphemeralPort() {
  const port = nextEphemeralPort
  nextEphemeralPort += 1
  if (nextEphemeralPort > 21_999) {
    nextEphemeralPort = EPHEMERAL_PORT_START
  }
  return port
}

export async function createApiApp(options: CreateApiAppOptions) {
  const env = options.env ?? process.env
  const database =
    options.database ?? (await createMigratedApiDatabase(resolveApiDatabaseOptions(env)))
  const store = options.store ?? (await createInvitationStore({ database, now: options.now }))
  const boardStore = options.boardStore ?? (await createBoardStore({ database, now: options.now }))
  const teamStore = options.teamStore ?? (await createTeamStore({ database, now: options.now }))
  const notificationStore =
    options.notificationStore ??
    (await createNotificationStore({
      database,
      now: options.now,
      onNotificationCreated: options.onNotificationCreated
    }))
  const auth =
    options.auth ??
    createInklyAuth({
      database,
      env,
      fallbackSecret: options.secret,
      logger: console
    })
  const app = new Hono()

  app.onError((error, c) => {
    const message = error instanceof Error ? (error.stack ?? error.message) : String(error)
    process.stderr.write(`[inkly-api] ${message}\n`)
    return c.json(
      {
        error: {
          code: 'internal_error',
          message: 'Internal server error'
        }
      },
      500
    )
  })

  app.route(
    '/api',
    createInviteRoutes({
      auth,
      secret: options.secret,
      store,
      boardStore,
      notificationStore,
      now: options.now
    })
  )

  app.route(
    '/api',
    createBoardRoutes({
      auth,
      boardStore,
      invitationStore: store,
      teamStore
    })
  )

  app.route(
    '/api',
    createTeamRoutes({
      auth,
      boardStore,
      teamStore,
      notificationStore
    })
  )

  app.route(
    '/api',
    createNotificationRoutes({
      auth,
      boardStore,
      notificationStore,
      teamStore,
      env
    })
  )

  app.route(
    '/api/test',
    createTestingRoutes({
      enabled: typeof auth.createTestSession === 'function',
      database,
      boardStore,
      invitationStore: store,
      teamStore,
      notificationStore
    })
  )

  app.route('/api/auth', createAuthRoutes({ auth, database, now: options.now }))

  if (env.INKLY_API_SERVE_STATIC !== '0') {
    const spaRoot = env.INKLY_API_STATIC_ROOT ?? './dist'
    app.use('/assets/*', serveStatic({ root: spaRoot }))
    app.use('/*', serveStatic({ root: spaRoot }))
    app.get('*', serveStatic({ path: `${spaRoot}/index.html` }))
  }

  return { app, store, boardStore, teamStore, notificationStore, database, auth }
}

export async function startApiServer(options: Partial<StartApiServerOptions> = {}) {
  const env = options.env ?? process.env
  const secret = options.secret ?? resolveJwtSecret(env)
  const host = options.host ?? env.INKLY_API_HOST ?? API_HOST
  const requestedPort = options.port ?? Number(env.PORT ?? env.INKLY_API_PORT ?? API_PORT)
  let onNotificationCreated: ((notification: NotificationRecord) => void) | undefined
  const { app, store, boardStore, teamStore, notificationStore, database, auth } =
    await createApiApp({
      boardStore: options.boardStore,
      teamStore: options.teamStore,
      notificationStore: options.notificationStore,
      database: options.database,
      auth: options.auth,
      env,
      secret,
      store: options.store,
      now: options.now,
      onNotificationCreated: (notification) => {
        onNotificationCreated?.(notification)
      }
    })
  const signaling = createSignalingServer()
  const notifications = createNotificationWebSocketServer(auth)
  onNotificationCreated = (notification) => {
    notifications.pushNotification(notification)
  }

  if (env.INKLY_API_AUTO_SWEEP === '1') {
    const timer = setInterval(() => {
      void notificationStore
        .sweepOldNotifications(DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS)
        .then((deletedCount) => {
          console.log(
            `[inkly-api] Notification auto-sweep deleted ${deletedCount} records older than ${DEFAULT_NOTIFICATION_SWEEP_OLDER_THAN_MS}ms`
          )
        })
    }, AUTO_SWEEP_INTERVAL_MS)
    timer.unref?.()
  }

  const createServer = (port: number) =>
    Bun.serve<SignalingPeerData | NotificationSocketData>({
      hostname: host,
      port,
      async fetch(request, server) {
        const signalingResponse = signaling.handleRequest(request, server)
        if (signalingResponse !== null) return signalingResponse
        const notificationsResponse = await notifications.handleRequest(request, server)
        if (notificationsResponse !== null) return notificationsResponse
        return app.fetch(request)
      },
      websocket: {
        open(socket: ServerWebSocket<SignalingPeerData | NotificationSocketData>) {
          if ('roomId' in socket.data) {
            signaling.websocket.open?.(socket as ServerWebSocket<SignalingPeerData>)
            return
          }

          notifications.open(socket as ServerWebSocket<NotificationSocketData>)
        },
        message(socket: ServerWebSocket<SignalingPeerData | NotificationSocketData>, message) {
          if ('roomId' in socket.data) {
            signaling.websocket.message?.(socket as ServerWebSocket<SignalingPeerData>, message)
          }
        },
        close(socket: ServerWebSocket<SignalingPeerData | NotificationSocketData>, code, reason) {
          if ('roomId' in socket.data) {
            signaling.websocket.close?.(socket as ServerWebSocket<SignalingPeerData>, code, reason)
            return
          }

          notifications.close(socket as ServerWebSocket<NotificationSocketData>)
        }
      }
    })

  let port = requestedPort
  let server: ReturnType<typeof createServer> | null = null
  let lastError: unknown = null

  for (let attempt = 0; attempt < 20; attempt += 1) {
    const candidatePort = requestedPort === 0 ? pickEphemeralPort() : requestedPort

    try {
      server = createServer(candidatePort)
      port = candidatePort
      break
    } catch (error) {
      lastError = error
      if (requestedPort !== 0) throw error
      const code =
        typeof error === 'object' && error !== null && 'code' in error ? error.code : undefined
      if (code !== 'EADDRINUSE') throw error
    }
  }

  if (!server) {
    throw lastError instanceof Error
      ? lastError
      : new Error('Failed to bind an ephemeral API port')
  }

  process.stderr.write(`Inkly API server listening on http://${host}:${port}\n`)

  return {
    app,
    store,
    boardStore,
    teamStore,
    notificationStore,
    database,
    auth,
    server,
    port,
    host
  }
}

if (import.meta.main) {
  void (async () => {
    try {
      await startApiServer()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      process.stderr.write(`[inkly-api] ${message}\n`)
      process.exit(1)
    }
  })()
}
