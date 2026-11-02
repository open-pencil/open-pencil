import type { Kysely } from 'kysely'

import { replaceCheckConstraint } from './helpers'

export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    [
      'document-invitation',
      'enrollment-requested',
      'admin-enrollment-notification',
      'enrollment-approved',
      'enrollment-rejected',
      'enrollment-revoked'
    ]
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    ['document-invitation']
  )
}
