import { renderTransactionalEmail } from '#cloud/email'
import type { TransactionalEmailKind } from '#cloud/email'
import type { CloudDatabase, TransactionalEmailStatus } from '#cloud/server/db'
import type { Kysely, Transaction } from 'kysely'

import { decryptTransactionalEmailPayload, encryptTransactionalEmailPayload } from './crypto'
import type {
  EnqueueTransactionalEmailInput,
  TransactionalEmailDeliveryOptions,
  TransactionalEmailDeliveryResult,
  TransactionalEmailService,
  TransactionalEmailTransport
} from './types'

const DEFAULT_MAXIMUM_ATTEMPTS = 5
const MAXIMUM_RETRY_DELAY_MS = 60 * 60_000

export type TransactionalEmailTransportErrorKind =
  | 'configuration'
  | 'suppressed'
  | 'permanent'
  | 'rate-limited'
  | 'transient'

export class TransactionalEmailTransportError extends Error {
  override readonly name = 'TransactionalEmailTransportError'

  constructor(
    readonly kind: TransactionalEmailTransportErrorKind,
    readonly code: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options)
  }
}

type ClaimedTransactionalEmail = {
  id: string
  kind: TransactionalEmailKind
  recipientEmailNormalized: string
  payloadEncrypted: string
  attemptCount: number
}

function normalizedEmail(value: string): string {
  return value.trim().toLowerCase()
}

function retryDelayMilliseconds(attemptCount: number): number {
  return Math.min(MAXIMUM_RETRY_DELAY_MS, 2 ** Math.max(0, attemptCount - 1) * 30_000)
}

function transportFailure(error: unknown): TransactionalEmailTransportError {
  return error instanceof TransactionalEmailTransportError
    ? error
    : new TransactionalEmailTransportError(
        'transient',
        'transport_error',
        'Transactional email transport failed',
        { cause: error }
      )
}

function failureStatus(
  error: TransactionalEmailTransportError,
  attemptCount: number,
  maximumAttempts: number
): TransactionalEmailStatus {
  if (error.kind === 'suppressed') return 'suppressed'
  if (error.kind === 'configuration' || error.kind === 'permanent') return 'failed'
  return attemptCount >= maximumAttempts ? 'failed' : 'pending'
}

export function createTransactionalEmailService(
  database: Kysely<CloudDatabase>,
  options: {
    encryptionSecret: string
    from: string
    transport?: TransactionalEmailTransport
  }
): TransactionalEmailService {
  return {
    async enqueue<Kind extends TransactionalEmailKind>(
      input: EnqueueTransactionalEmailInput<Kind>,
      transaction: Transaction<CloudDatabase> | undefined
    ): Promise<string> {
      const id = crypto.randomUUID()
      const payloadEncrypted = await encryptTransactionalEmailPayload(
        options.encryptionSecret,
        id,
        input.kind,
        input.payload
      )
      const executor = transaction ?? database
      const row = await executor
        .insertInto('transactionalEmail')
        .values({
          id,
          idempotencyKey: input.idempotencyKey,
          kind: input.kind,
          recipientEmailNormalized: normalizedEmail(input.recipientEmail),
          payloadEncrypted,
          status: 'pending',
          nextAttemptAt: new Date(),
          claimId: null,
          claimedAt: null,
          transport: null,
          transportMessageId: null,
          lastErrorCode: null,
          acceptedAt: null
        })
        .onConflict((conflict) => conflict.column('idempotencyKey').doNothing())
        .returning('id')
        .executeTakeFirst()
      if (row) return row.id
      return (
        await executor
          .selectFrom('transactionalEmail')
          .select('id')
          .where('idempotencyKey', '=', input.idempotencyKey)
          .executeTakeFirstOrThrow()
      ).id
    },

    async deliverPending(
      deliveryOptions: TransactionalEmailDeliveryOptions
    ): Promise<TransactionalEmailDeliveryResult> {
      if (!options.transport) {
        return { claimed: 0, accepted: 0, retrying: 0, failed: 0, suppressed: 0 }
      }
      const now = deliveryOptions.now ?? new Date()
      const maximumAttempts = deliveryOptions.maximumAttempts ?? DEFAULT_MAXIMUM_ATTEMPTS
      const staleBefore = new Date(now.getTime() - deliveryOptions.leaseDurationMs)
      const claimId = crypto.randomUUID()
      const claimed = await database.transaction().execute(async (transaction) => {
        const candidates = await transaction
          .selectFrom('transactionalEmail')
          .select(['id', 'kind', 'recipientEmailNormalized', 'payloadEncrypted', 'attemptCount'])
          .where('payloadEncrypted', 'is not', null)
          .where((expression) =>
            expression.or([
              expression.and([
                expression('status', '=', 'pending'),
                expression('nextAttemptAt', '<=', now)
              ]),
              expression.and([
                expression('status', '=', 'sending'),
                expression('claimedAt', '<=', staleBefore)
              ])
            ])
          )
          .orderBy('nextAttemptAt')
          .limit(deliveryOptions.batchSize)
          .forUpdate()
          .skipLocked()
          .execute()
        if (candidates.length === 0) return []
        await transaction
          .updateTable('transactionalEmail')
          .set({ status: 'sending', claimId, claimedAt: now, updatedAt: now })
          .where(
            'id',
            'in',
            candidates.map((candidate) => candidate.id)
          )
          .execute()
        return candidates.filter(
          (candidate): candidate is ClaimedTransactionalEmail => candidate.payloadEncrypted !== null
        )
      })

      const result: TransactionalEmailDeliveryResult = {
        claimed: claimed.length,
        accepted: 0,
        retrying: 0,
        failed: 0,
        suppressed: 0
      }
      for (const message of claimed) {
        const attemptCount = message.attemptCount + 1
        try {
          const payload = await decryptTransactionalEmailPayload(
            options.encryptionSecret,
            message.id,
            message.kind,
            message.payloadEncrypted
          )
          const rendered = await renderTransactionalEmail(message.kind, payload)
          const sent = await options.transport.send({
            deliveryId: message.id,
            from: options.from,
            to: message.recipientEmailNormalized,
            subject: rendered.subject,
            html: rendered.html,
            text: rendered.text,
            headers: { 'X-OpenPencil-Delivery-ID': message.id }
          })
          await database
            .updateTable('transactionalEmail')
            .set({
              payloadEncrypted: null,
              status: 'accepted',
              attemptCount,
              transport: options.transport.id,
              transportMessageId: sent.transportMessageId,
              lastErrorCode: null,
              acceptedAt: new Date(sent.acceptedAt),
              claimId: null,
              claimedAt: null,
              updatedAt: now
            })
            .where('id', '=', message.id)
            .where('claimId', '=', claimId)
            .execute()
          result.accepted++
        } catch (unknownError) {
          const error = transportFailure(unknownError)
          const status = failureStatus(error, attemptCount, maximumAttempts)
          const terminal = status === 'failed' || status === 'suppressed'
          await database
            .updateTable('transactionalEmail')
            .set({
              payloadEncrypted: terminal ? null : message.payloadEncrypted,
              status,
              attemptCount,
              nextAttemptAt: new Date(now.getTime() + retryDelayMilliseconds(attemptCount)),
              transport: options.transport.id,
              lastErrorCode: error.code,
              claimId: null,
              claimedAt: null,
              updatedAt: now
            })
            .where('id', '=', message.id)
            .where('claimId', '=', claimId)
            .execute()
          if (status === 'suppressed') result.suppressed++
          else if (status === 'failed') result.failed++
          else result.retrying++
        }
      }
      return result
    }
  }
}
