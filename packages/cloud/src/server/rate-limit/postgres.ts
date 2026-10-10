import type { CloudDatabase } from '#cloud/server/db'
import { sha256 } from '@noble/hashes/sha2.js'
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js'
import type { ClientRateLimitInfo, Store } from 'hono-rate-limiter'
import type { Kysely } from 'kysely'

export class PostgresRateLimitStore implements Store {
  readonly localKeys = false
  readonly prefix: string
  private windowMs = 60_000

  constructor(
    private readonly database: Kysely<CloudDatabase>,
    private readonly secret: string,
    namespace: string,
    options: { windowMs?: number } = {}
  ) {
    this.prefix = `${namespace}:`
    this.windowMs = options.windowMs ?? this.windowMs
  }

  init(options: { windowMs: number }): void {
    this.windowMs = options.windowMs
  }

  private hash(key: string): string {
    return bytesToHex(sha256(utf8ToBytes(`${this.secret}:${this.prefix}:${key}`)))
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const now = new Date()
    const resetTime = new Date(
      Math.floor(now.getTime() / this.windowMs) * this.windowMs + this.windowMs
    )
    const row = await this.database
      .insertInto('cloudRateLimit')
      .values({
        keyHash: this.hash(key),
        windowStartedAt: new Date(resetTime.getTime() - this.windowMs),
        requestCount: 1,
        updatedAt: now
      })
      .onConflict((conflict) =>
        conflict.column('keyHash').doUpdateSet((expression) => ({
          requestCount: expression
            .case()
            .whenRef('cloudRateLimit.windowStartedAt', '=', 'excluded.windowStartedAt')
            .then(expression('cloudRateLimit.requestCount', '+', 1))
            .else(1)
            .end(),
          windowStartedAt: expression.ref('excluded.windowStartedAt'),
          updatedAt: expression.ref('excluded.updatedAt')
        }))
      )
      .returning(['requestCount', 'windowStartedAt'])
      .executeTakeFirstOrThrow()
    return {
      totalHits: Number(row.requestCount),
      resetTime: new Date(new Date(row.windowStartedAt).getTime() + this.windowMs)
    }
  }

  async decrement(key: string): Promise<void> {
    await this.database
      .updateTable('cloudRateLimit')
      .set((expression) => ({
        requestCount: expression.fn('greatest', [
          expression('requestCount', '-', 1),
          expression.val(0)
        ])
      }))
      .where('keyHash', '=', this.hash(key))
      .execute()
  }

  async resetKey(key: string): Promise<void> {
    await this.database.deleteFrom('cloudRateLimit').where('keyHash', '=', this.hash(key)).execute()
  }
}
