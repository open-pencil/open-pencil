import { Hono } from 'hono'

import { createBoardStore } from './boardStore.js'
import { createBoardRoutes } from './routes/boards.js'
import { createInviteRoutes } from './routes/invite.js'
import { createInvitationStore } from './store.js'
import { requireJwtSecret } from './token.js'
import type { BoardStore, InvitationStore } from './types.js'
import { createSignalingServer } from './ws/signaling.js'

export const API_HOST = '127.0.0.1'
export const API_PORT = 3001

export interface CreateApiAppOptions {
  secret: string
  store?: InvitationStore
  boardStore?: BoardStore
  now?: () => number
}

export interface StartApiServerOptions extends CreateApiAppOptions {
  port?: number
  host?: string
}

export function createApiApp(options: CreateApiAppOptions) {
  const store = options.store ?? createInvitationStore()
  const boardStore = options.boardStore ?? createBoardStore()
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
      secret: options.secret,
      store,
      boardStore,
      now: options.now
    })
  )

  app.route(
    '/api',
    createBoardRoutes({
      boardStore,
      invitationStore: store
    })
  )

  return { app, store, boardStore }
}

export function startApiServer(options: Partial<StartApiServerOptions> = {}) {
  const secret = options.secret ?? requireJwtSecret()
  const port = options.port ?? API_PORT
  const host = options.host ?? API_HOST
  const { app, store, boardStore } = createApiApp({
    boardStore: options.boardStore,
    secret,
    store: options.store,
    now: options.now
  })
  const signaling = createSignalingServer()

  const server = Bun.serve({
    hostname: host,
    port,
    fetch(request, server) {
      const signalingResponse = signaling.handleRequest(request, server)
      if (signalingResponse !== null) return signalingResponse
      return app.fetch(request)
    },
    websocket: signaling.websocket
  })

  process.stderr.write(`Inkly API server listening on http://${host}:${port}\n`)

  return { app, store, boardStore, server, port, host }
}

if (import.meta.main) {
  try {
    startApiServer()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    process.stderr.write(`[inkly-api] ${message}\n`)
    process.exit(1)
  }
}
