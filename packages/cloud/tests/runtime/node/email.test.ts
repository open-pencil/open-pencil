import { describe, expect, test } from 'bun:test'

import { renderTransactionalEmail } from '@open-pencil/cloud/email'
import { createNodemailerTransactionalEmailTransport } from '@open-pencil/cloud/runtime/node'

const payload = {
  inviterName: 'Alice',
  documentName: 'Homepage',
  permission: 'edit' as const,
  expiresAt: '2026-01-08T00:00:00.000Z',
  acceptanceURL:
    'https://app.example.com/cloud/invitations/invitation-id?server=https%3A%2F%2Fcloud.example.com#secret-token'
}

describe('transactional email delivery', () => {
  test('renders matching HTML and plain-text invitations', async () => {
    const rendered = await renderTransactionalEmail('document-invitation', payload)
    expect(rendered.subject).toContain('Alice invited you to edit Homepage')
    expect(rendered.html).toContain('OpenPencil invitation')
    expect(rendered.html).toContain(payload.acceptanceURL.replaceAll('&', '&amp;'))
    expect(rendered.text).toContain(payload.acceptanceURL)
  })

  test('sends rendered messages through injected Nodemailer transports', async () => {
    const sent: unknown[] = []
    const transport = createNodemailerTransactionalEmailTransport({
      transporter: {
        async sendMail(mail) {
          sent.push(mail)
          return { messageId: 'message-id' }
        }
      }
    })
    expect(
      await transport.send({
        deliveryId: 'delivery-id',
        from: 'OpenPencil <cloud@example.com>',
        to: 'recipient@example.com',
        subject: 'Invitation',
        html: '<p>Invitation</p>',
        text: 'Invitation',
        headers: { 'X-OpenPencil-Delivery-ID': 'delivery-id' }
      })
    ).toMatchObject({ transportMessageId: 'message-id' })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      from: 'OpenPencil <cloud@example.com>',
      to: 'recipient@example.com',
      headers: { 'X-OpenPencil-Delivery-ID': 'delivery-id' }
    })
  })
})
