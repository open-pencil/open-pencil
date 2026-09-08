import { createEnrollmentService } from '#cloud/admin/enrollment/service'
import type { CloudServerConfig } from '#cloud/server/config'
import type { CloudDatabase } from '#cloud/server/db'
import type { TransactionalEmailService } from '#cloud/server/email'
import type { Kysely } from 'kysely'

import { createAuthenticationEmailService } from './email'
import { createBetterAuthAdapter, type CloudAuthRuntimeOptions } from './factory'

export function createCloudAuthenticationRuntime(
  config: CloudServerConfig,
  database: Kysely<CloudDatabase>,
  email: TransactionalEmailService,
  options: Pick<CloudAuthRuntimeOptions, 'runInBackground'> = {}
) {
  const enrollment = createEnrollmentService(database, {
    appURL: config.appURL ?? config.publicURL,
    adminRecipients: config.enrollmentAdminNotificationEmails,
    email
  })
  const auth = createBetterAuthAdapter(config, database, enrollment, {
    email: createAuthenticationEmailService(email, config.publicURL),
    ...options
  })
  return { auth, enrollment }
}
