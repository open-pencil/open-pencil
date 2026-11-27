import type { EnrollmentEmailOptions } from '#cloud/admin/enrollment/email'
import { createEnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Kysely } from 'kysely'

import { createAuthenticationEmailService } from './email'
import { createBetterAuthAdapter, type CloudAuthRuntimeOptions } from './factory'

/**
 * What the enrollment service tells people, from the server's settings: where its links go, who
 * hears about new requests, and whether approvals may carry the official deployment's letter.
 * Every place that builds the service takes it from here, so none of them disagrees.
 */
export function enrollmentEmailOptions(
  config: CloudServerConfig,
  email: TransactionalEmailService | undefined
): EnrollmentEmailOptions {
  return {
    publicURL: config.publicURL,
    adminRecipients: config.enrollmentAdminNotificationEmails,
    email
  }
}

export function createCloudAuthenticationRuntime(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  email: TransactionalEmailService,
  options: Pick<
    CloudAuthRuntimeOptions,
    'runInBackground' | 'validateSchema' | 'fetchClientMetadata'
  > = {}
) {
  const enrollment = createEnrollmentService(database, enrollmentEmailOptions(config, email))
  const auth = createBetterAuthAdapter(config, database, enrollment, {
    email: createAuthenticationEmailService(email, config.publicURL),
    ...options
  })
  return { auth, enrollment }
}
