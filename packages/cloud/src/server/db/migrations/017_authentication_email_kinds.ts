import type { Kysely } from 'kysely'

import { replaceCheckConstraint } from './helpers'

const kinds = [
  'document-invitation',
  'enrollment-requested',
  'admin-enrollment-notification',
  'enrollment-approved',
  'enrollment-rejected',
  'enrollment-revoked'
]

export async function up(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    [...kinds, 'email-verification', 'password-reset', 'password-changed']
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    kinds
  )
}
