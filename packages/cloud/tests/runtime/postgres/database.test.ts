import { afterEach, describe, expect, jest, test } from 'bun:test'
import { once } from 'node:events'
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
  const accepted = once(server, 'connection')
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('The server has no port')
  return {
    accepted,
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
      const outcome = sql`select 1`.execute(database).then(
        () => 'answered' as const,
        (error: unknown) => error
      )
      await server.accepted
      jest.advanceTimersByTime(POSTGRES_CONNECTION_TIMEOUT_MS - 1)
      // A settled query wins the race, since it comes first.
      expect(await Promise.race([outcome, Promise.resolve('pending')])).toBe('pending')
      jest.advanceTimersByTime(1)
      const error = await outcome
      expect(error).toBeInstanceOf(Error)
      expect(String(error)).toMatch(/timeout/i)
    } finally {
      jest.useRealTimers()
      await database.destroy()
      server.close()
    }
  })
})
