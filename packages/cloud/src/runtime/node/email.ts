import { renderTransactionalEmail } from '#cloud/email'
import type { TransactionalEmailTransport } from '#cloud/server/email'
import type { DocumentInvitationMessage, InvitationDelivery } from '#cloud/server/invitations'
import nodemailer, { type Transporter } from 'nodemailer'
import type Mail from 'nodemailer/lib/mailer/index.js'

export type NodemailerTransporter = {
  sendMail(mail: Mail.Options): Promise<unknown>
}

export type NodemailerTransactionalEmailTransportOptions = {
  transporter: NodemailerTransporter
}

export function createNodemailerTransactionalEmailTransport(
  options: NodemailerTransactionalEmailTransportOptions
): TransactionalEmailTransport {
  return {
    id: 'smtp',
    async send(message) {
      const result = (await options.transporter.sendMail({
        from: message.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
        headers: message.headers,
        messageId: `<${message.deliveryId}@openpencil.cloud>`
      })) as { messageId?: unknown }
      if (typeof result.messageId !== 'string') {
        throw new TypeError('SMTP transport returned no message ID')
      }
      return {
        transportMessageId: result.messageId,
        acceptedAt: new Date().toISOString()
      }
    }
  }
}

export type SMTPTransactionalEmailTransportOptions = {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
}

function createSMTPTransporter(options: SMTPTransactionalEmailTransportOptions): Transporter {
  return nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth:
      options.user && options.password ? { user: options.user, pass: options.password } : undefined
  })
}

export function createSMTPTransactionalEmailTransport(
  options: SMTPTransactionalEmailTransportOptions
): TransactionalEmailTransport {
  return createNodemailerTransactionalEmailTransport({
    transporter: createSMTPTransporter(options)
  })
}

export type NodemailerInvitationDeliveryOptions = NodemailerTransactionalEmailTransportOptions & {
  from: string
}

export function createNodemailerInvitationDelivery(
  options: NodemailerInvitationDeliveryOptions
): InvitationDelivery {
  const transport = createNodemailerTransactionalEmailTransport(options)
  return {
    async sendDocumentInvitation(message: DocumentInvitationMessage): Promise<void> {
      const rendered = await renderTransactionalEmail('document-invitation', {
        inviterName: message.inviterName,
        documentName: message.documentName,
        permission: message.permission,
        expiresAt: message.expiresAt,
        acceptanceURL: message.acceptanceURL
      })
      await transport.send({
        deliveryId: message.deliveryId,
        from: options.from,
        to: message.recipientEmail,
        ...rendered,
        headers: { 'X-OpenPencil-Delivery-ID': message.deliveryId }
      })
    }
  }
}

export type SMTPInvitationDeliveryOptions = SMTPTransactionalEmailTransportOptions & {
  from: string
}

export function createSMTPInvitationDelivery(
  options: SMTPInvitationDeliveryOptions
): InvitationDelivery {
  return createNodemailerInvitationDelivery({
    transporter: createSMTPTransporter(options),
    from: options.from
  })
}
