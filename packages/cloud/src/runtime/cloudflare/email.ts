import {
  TransactionalEmailTransportError,
  type TransactionalEmailEnvelope,
  type TransactionalEmailTransport,
  type TransactionalEmailTransportErrorKind
} from '#cloud/server/email'

/** The part of a Worker's `send_email` binding the transport uses. */
export type CloudflareEmailBinding = {
  send(message: {
    to: string
    from: string
    subject: string
    html: string
    text: string
    headers?: Record<string, string>
  }): Promise<{ messageId: string }>
}

/** Cloudflare Email Service error codes, by what retrying them would do. */
const ERROR_KINDS: Record<string, TransactionalEmailTransportErrorKind> = {
  E_SENDER_NOT_VERIFIED: 'configuration',
  E_RECIPIENT_NOT_ALLOWED: 'configuration',
  E_SENDER_DOMAIN_NOT_AVAILABLE: 'configuration',
  E_RECIPIENT_SUPPRESSED: 'suppressed',
  E_VALIDATION_ERROR: 'permanent',
  E_FIELD_MISSING: 'permanent',
  E_TOO_MANY_RECIPIENTS: 'permanent',
  E_TOO_MANY_ATTACHMENTS: 'permanent',
  E_CONTENT_TOO_LARGE: 'permanent',
  E_DELIVERY_FAILED: 'permanent',
  E_RATE_LIMIT_EXCEEDED: 'rate-limited',
  E_DAILY_LIMIT_EXCEEDED: 'rate-limited'
}

function errorCode(error: unknown): string {
  return error instanceof Error && 'code' in error && typeof error.code === 'string'
    ? error.code
    : 'E_UNKNOWN'
}

/** Sends transactional email through a Worker's `send_email` binding. */
export function createCloudflareEmailTransport(
  binding: CloudflareEmailBinding
): TransactionalEmailTransport {
  return {
    id: 'cloudflare-email-service',
    async send(message: TransactionalEmailEnvelope) {
      try {
        const result = await binding.send({
          to: message.to,
          from: message.from,
          subject: message.subject,
          html: message.html,
          text: message.text,
          headers: message.headers
        })
        return { transportMessageId: result.messageId, acceptedAt: new Date().toISOString() }
      } catch (error) {
        const code = errorCode(error)
        throw new TransactionalEmailTransportError(
          ERROR_KINDS[code] ?? 'transient',
          code,
          'Cloudflare Email Service rejected a transactional email',
          { cause: error }
        )
      }
    }
  }
}
