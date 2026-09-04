import { createSMTPTransactionalEmailTransport } from '#cloud/runtime/node/email'
import {
  createInvitationOutbox,
  createTransactionalEmailService,
  type CloudServerConfig,
  type TransactionalEmailService,
  type TransactionalEmailTransport
} from '#cloud/server'
import type { CloudDatabase } from '#cloud/server/db'
import type { Kysely } from 'kysely'

export type NodeTransactionalEmailRuntime = {
  email: TransactionalEmailService
  transport?: TransactionalEmailTransport
  invitationOutbox?: ReturnType<typeof createInvitationOutbox>
}

export function createNodeTransactionalEmailRuntime(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>
): NodeTransactionalEmailRuntime {
  const transport =
    config.emailTransport === 'smtp' && config.smtpHost && config.smtpPort
      ? createSMTPTransactionalEmailTransport({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpSecure ?? config.smtpPort === 465,
          user: config.smtpUser,
          password: config.smtpPassword
        })
      : undefined
  const email = createTransactionalEmailService(database, {
    encryptionSecret: config.authSecret,
    from: config.emailFrom ?? '',
    transport
  })
  return {
    email,
    transport,
    invitationOutbox: transport ? createInvitationOutbox(email) : undefined
  }
}
