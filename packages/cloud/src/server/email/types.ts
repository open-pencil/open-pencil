import type {
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
