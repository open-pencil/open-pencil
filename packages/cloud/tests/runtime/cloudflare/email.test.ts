import { describe, expect, test } from 'bun:test'

import {
  createCloudflareEmailTransport,
  type CloudflareEmailBinding
} from '@open-pencil/cloud/runtime/cloudflare'
import { TransactionalEmailTransportError } from '@open-pencil/cloud/server'

const envelope = {
  deliveryId: 'delivery-id',
  from: 'notifications@mail.openpencil.dev',
  to: 'person@example.com',
  subject: 'Welcome',
  html: '<p>Welcome</p>',
  text: 'Welcome',
  headers: { 'X-OpenPencil-Delivery-ID': 'delivery-id' }
}

describe('Cloudflare Email Service transport', () => {
  test('sends structured HTML and text through the Worker binding', async () => {
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

  test('normalizes Cloudflare suppression errors', async () => {
    const binding: CloudflareEmailBinding = {
      async send() {
        throw Object.assign(new Error('Suppressed'), { code: 'E_RECIPIENT_SUPPRESSED' })
      }
    }
    const error = await createCloudflareEmailTransport(binding)
      .send(envelope)
      .catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(TransactionalEmailTransportError)
    expect(error).toMatchObject({ kind: 'suppressed', code: 'E_RECIPIENT_SUPPRESSED' })
  })
})
