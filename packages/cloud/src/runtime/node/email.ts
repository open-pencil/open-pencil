import { renderDocumentInvitationEmail } from '#cloud/email'
import type { DocumentInvitationMessage, InvitationDelivery } from '#cloud/server/invitations'
import nodemailer, { type Transporter } from 'nodemailer'

export type NodemailerInvitationDeliveryOptions = {
  transporter: Transporter
  from: string
}

export function createNodemailerInvitationDelivery(
  options: NodemailerInvitationDeliveryOptions
): InvitationDelivery {
  return {
    async sendDocumentInvitation(message: DocumentInvitationMessage): Promise<void> {
      const rendered = await renderDocumentInvitationEmail(message)
      await options.transporter.sendMail({
        from: options.from,
        to: message.recipientEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        headers: { 'X-OpenPencil-Delivery-ID': message.deliveryId }
      })
    }
  }
}

export type SMTPInvitationDeliveryOptions = {
  host: string
  port: number
  secure: boolean
  user?: string
  password?: string
  from: string
}

export function createSMTPInvitationDelivery(
  options: SMTPInvitationDeliveryOptions
): InvitationDelivery {
  const transporter = nodemailer.createTransport({
    host: options.host,
    port: options.port,
    secure: options.secure,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 30_000,
    auth:
      options.user && options.password ? { user: options.user, pass: options.password } : undefined
  })
  return createNodemailerInvitationDelivery({ transporter, from: options.from })
}
