import { describe, expect, test } from 'bun:test'

import {
  createCloudflareEmailTransport,
  type CloudflareEmailBinding
} from '#cloud/runtime/cloudflare/email'
import { TransactionalEmailTransportError } from '#cloud/server'

const envelope = {
  deliveryId: 'delivery-id',
  from: 'notifications@openpencil.dev',
  to: 'person@example.com',
  subject: 'Welcome',
  html: '<p>Welcome</p>',
  text: 'Welcome',
  headers: { 'X-OpenPencil-Delivery-ID': 'delivery-id' }
}

function failingWith(code?: string): CloudflareEmailBinding {
  return {
    async send() {
      throw Object.assign(new Error('Rejected'), code ? { code } : {})
    }
  }
}

describe('Cloudflare Email Service transport', () => {
  test('sends HTML, text, and headers through the Worker binding', async () => {
    const sent: unknown[] = []
    const transport = createCloudflareEmailTransport({
      async send(message) {
        sent.push(message)
        return { messageId: 'cloudflare-message-id' }
      }
    })
    expect(await transport.send(envelope)).toMatchObject({
      transportMessageId: 'cloudflare-message-id'
    })
    expect(sent).toEqual([
      {
        from: envelope.from,
        to: envelope.to,
        subject: envelope.subject,
        html: envelope.html,
        text: envelope.text,
        headers: envelope.headers
      }
    ])
  })

  test('tells a delivery to stop, wait, or retry by the error code', async () => {
    const kinds = await Promise.all(
      ['E_RECIPIENT_SUPPRESSED', 'E_SENDER_NOT_VERIFIED', 'E_DAILY_LIMIT_EXCEEDED', undefined].map(
        (code) =>
          createCloudflareEmailTransport(failingWith(code))
            .send(envelope)
            .catch((error: unknown) => error)
      )
    )
    for (const error of kinds) expect(error).toBeInstanceOf(TransactionalEmailTransportError)
    expect(kinds).toMatchObject([
      { kind: 'suppressed', code: 'E_RECIPIENT_SUPPRESSED' },
      { kind: 'configuration', code: 'E_SENDER_NOT_VERIFIED' },
      { kind: 'rate-limited', code: 'E_DAILY_LIMIT_EXCEEDED' },
      { kind: 'transient', code: 'E_UNKNOWN' }
    ])
  })
})
