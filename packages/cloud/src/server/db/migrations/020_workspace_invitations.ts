import { checkColumnIn } from '#cloud/server/db/expressions'
import type { Kysely } from 'kysely'

import { addCurrentTimestampColumns, addInvitationColumns, replaceCheckConstraint } from './helpers'

const emailKinds = [
  'document-invitation',
  'enrollment-requested',
  'admin-enrollment-notification',
  'enrollment-approved',
  'enrollment-rejected',
  'enrollment-revoked',
  'email-verification',
  'password-reset',
  'password-changed'
]

export async function up(database: Kysely<unknown>): Promise<void> {
  await addInvitationColumns(
    database.schema
      .createTable('workspace_invitation')
      .addColumn('id', 'uuid', (column) => column.primaryKey())
      .addColumn('workspace_id', 'uuid', (column) =>
        column.references('workspace.id').onDelete('cascade').notNull()
      ),
    'role'
  )
    .addCheckConstraint(
      'workspace_invitation_role_check',
      checkColumnIn('role', ['admin', 'editor', 'viewer'])
    )
    .execute()
  await addCurrentTimestampColumns(database, 'workspace_invitation', ['invited_at'])
  await database.schema
    .createIndex('workspace_invitation_workspace_index')
    .on('workspace_invitation')
    .columns(['workspace_id', 'revoked_at'])
    .execute()
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    [...emailKinds, 'workspace-invitation']
  )
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await replaceCheckConstraint(
    database,
    'transactional_email',
    'transactional_email_kind_check',
    'kind',
    emailKinds
  )
  await database.schema.dropTable('workspace_invitation').execute()
}
