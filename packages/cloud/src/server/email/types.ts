import type {
  EmailLocale,
  RenderedTransactionalEmail,
  TransactionalEmailKind,
  TransactionalEmailPayloadByKind
} from '#cloud/email'
import type { CloudDatabase } from '#cloud/server/db'
import type { Transaction } from 'kysely'

export type TransactionalEmailEnvelope = RenderedTransactionalEmail & {
  deliveryId: string
  from: string
  to: string
  headers: Record<string, string>
}

export type TransactionalEmailSendResult = {
  transportMessageId: string
  acceptedAt: string
}

export type TransactionalEmailTransport = {
  id: string
  send(envelope: TransactionalEmailEnvelope): Promise<TransactionalEmailSendResult>
}

export type EnqueueTransactionalEmailInput<Kind extends TransactionalEmailKind> = {
  idempotencyKey: string
  kind: Kind
  recipientEmail: string
  payload: TransactionalEmailPayloadByKind[Kind]
  /**
   * The recipient account's own language, when the sender has the account: the email is then
   * written in it, or in English when it has none, without looking the account up. Signing up
   * needs this, since its callbacks run inside its transaction and must not query the database.
   */
  recipientLocale?: EmailLocale | null
  /**
   * The language to write in when the recipient has no account that chose one: the inviter's for
   * an invitation. English otherwise.
   */
  fallbackLocale?: EmailLocale | null
}

export type TransactionalEmailDeliveryOptions = {
  batchSize: number
  leaseDurationMs: number
  maximumAttempts?: number
  now?: Date
}

export type TransactionalEmailDeliveryResult = {
  claimed: number
  accepted: number
  retrying: number
  failed: number
  suppressed: number
}

export type TransactionalEmailService = {
  enqueue<Kind extends TransactionalEmailKind>(
    input: EnqueueTransactionalEmailInput<Kind>,
    transaction?: Transaction<CloudDatabase>
  ): Promise<string>
  deliverPending(
    options: TransactionalEmailDeliveryOptions
  ): Promise<TransactionalEmailDeliveryResult>
}
