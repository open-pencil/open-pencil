import { describe, expect, test } from 'bun:test'

import { renderDocumentInvitationEmail } from '@open-pencil/cloud/email'
import { createNodemailerInvitationDelivery } from '@open-pencil/cloud/runtime/node'

const message = {
  deliveryId: 'delivery-id',
  recipientEmail: 'recipient@example.com',
  inviterName: 'Alice',
  documentName: 'Homepage',
  permission: 'edit' as const,
  expiresAt: '2026-01-08T00:00:00.000Z',
  acceptanceURL:
    'https://app.example.com/cloud/invitations/invitation-id?server=https%3A%2F%2Fcloud.example.com#secret-token'
}

describe('invitation email delivery', () => {
  test('renders matching HTML and plain-text invitations', async () => {
    const rendered = await renderDocumentInvitationEmail(message)
    expect(rendered.subject).toContain('Alice invited you to edit Homepage')
    expect(rendered.html).toContain('OpenPencil invitation')
    expect(rendered.html).toContain(message.acceptanceURL.replaceAll('&', '&amp;'))
    expect(rendered.text).toContain(message.acceptanceURL)
  })

  test('sends rendered invitations through injected Nodemailer transports', async () => {
    const sent: unknown[] = []
    const delivery = createNodemailerInvitationDelivery({
      from: 'OpenPencil <cloud@example.com>',
      transporter: {
        async sendMail(mail: unknown) {
          sent.push(mail)
          return { messageId: 'message-id' }
        }
      } as never
    })
    await delivery.sendDocumentInvitation(message)
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({
      from: 'OpenPencil <cloud@example.com>',
      to: 'recipient@example.com',
      headers: { 'X-OpenPencil-Delivery-ID': 'delivery-id' }
    })
  })
})
