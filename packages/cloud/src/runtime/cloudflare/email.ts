import {
  TransactionalEmailTransportError,
  type TransactionalEmailEnvelope,
  type TransactionalEmailTransport
} from '#cloud/server/email'

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

type CloudflareEmailError = Error & { code?: string }

const CONFIGURATION_ERRORS = new Set([
  'E_SENDER_NOT_VERIFIED',
  'E_RECIPIENT_NOT_ALLOWED',
  'E_SENDER_DOMAIN_NOT_AVAILABLE'
])
const PERMANENT_ERRORS = new Set([
  'E_VALIDATION_ERROR',
  'E_FIELD_MISSING',
  'E_TOO_MANY_RECIPIENTS',
  'E_TOO_MANY_ATTACHMENTS',
  'E_CONTENT_TOO_LARGE',
  'E_DELIVERY_FAILED'
])
const RATE_LIMIT_ERRORS = new Set(['E_RATE_LIMIT_EXCEEDED', 'E_DAILY_LIMIT_EXCEEDED'])

function cloudflareTransportError(error: unknown): TransactionalEmailTransportError {
  const cloudflareError = error as CloudflareEmailError
  const code = cloudflareError.code ?? 'E_UNKNOWN'
  let kind: 'configuration' | 'suppressed' | 'permanent' | 'rate-limited' | 'transient' =
    'transient'
  if (CONFIGURATION_ERRORS.has(code)) kind = 'configuration'
  else if (code === 'E_RECIPIENT_SUPPRESSED') kind = 'suppressed'
  else if (PERMANENT_ERRORS.has(code)) kind = 'permanent'
  else if (RATE_LIMIT_ERRORS.has(code)) kind = 'rate-limited'
  return new TransactionalEmailTransportError(
    kind,
    code,
    'Cloudflare Email Service rejected a transactional email',
    { cause: error }
  )
}

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
        return {
          transportMessageId: result.messageId,
          acceptedAt: new Date().toISOString()
        }
      } catch (error) {
        throw cloudflareTransportError(error)
      }
    }
  }
}
