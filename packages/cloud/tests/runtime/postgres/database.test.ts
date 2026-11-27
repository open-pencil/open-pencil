import { afterEach, describe, expect, jest, test } from 'bun:test'
import { createServer, type Socket } from 'node:net'

import { createPostgresCloudDatabase } from '#cloud/runtime/postgres/database'
import { POSTGRES_CONNECTION_TIMEOUT_MS } from '#cloud/runtime/postgres/timeouts'
import { sql } from 'kysely'

/** A server that accepts connections and never answers, like a database behind a dropping network. */
async function silentServer() {
  const sockets = new Set<Socket>()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('The server has no port')
  return {
    url: `postgresql://openpencil:openpencil@127.0.0.1:${address.port}/openpencil`,
    close() {
      for (const socket of sockets) socket.destroy()
      server.close()
    }
  }
}

describe('createPostgresCloudDatabase', () => {
  afterEach(() => {
    jest.useRealTimers()
  })

  test('fails a connection the database never answers instead of waiting forever', async () => {
    const server = await silentServer()
    jest.useFakeTimers()
    const database = createPostgresCloudDatabase({ connectionString: server.url })
    try {
      const query = sql`select 1`.execute(database).then(
        () => 'answered',
        () => 'failed'
      )
      // Let the socket connect before the clock moves.
      await new Promise((resolve) => {
        setImmediate(resolve)
      })
      jest.advanceTimersByTime(POSTGRES_CONNECTION_TIMEOUT_MS)
      expect(await query).toBe('failed')
    } finally {
      jest.useRealTimers()
      await database.destroy()
      server.close()
    }
  })
})
