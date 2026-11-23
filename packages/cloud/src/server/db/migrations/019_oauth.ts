import { sql, type ColumnDefinitionBuilder, type Kysely } from 'kysely'

import { addIndexes, dropTables, now, required } from './schema'

const TABLES = [
  'oauth_client',
  'oauth_resource',
  'oauth_client_resource',
  'oauth_refresh_token',
  'oauth_access_token',
  'oauth_consent',
  'oauth_client_assertion',
  'oauth_workspace_choice'
]

const generatedID = (column: ColumnDefinitionBuilder) =>
  column.primaryKey().defaultTo(sql`gen_random_uuid()`)
const clientReference = (column: ColumnDefinitionBuilder) =>
  column.notNull().references('oauth_client.client_id').onDelete('cascade')

/**
 * Apps people connect through OAuth, kept by Better Auth's OAuth provider plugin in the tables it
 * would build itself, as `009_access_tokens` does for personal access tokens: Better Auth's tables
 * are built only once, so a deployment that has them gains these as any other migration, and
 * Better Auth's own migration leaves the plugin out (`createBetterAuthAdapter`). Account and
 * session IDs are text without foreign keys, like every table Cloud builds; account deletion
 * removes an account's rows. Tokens and client secrets are kept as SHA-256 digests.
 *
 * `oauth_workspace_choice` is Cloud's own: the workspace a person picked for the app they are
 * connecting, per session, which the grant then reaches.
 */
export async function up(database: Kysely<unknown>): Promise<void> {
  await database.schema
    .createTable('oauth_client')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('client_id', 'text', (column) => column.notNull().unique())
    .addColumn('client_secret', 'text')
    .addColumn('client_discovery_id', 'text')
    .addColumn('disabled', 'boolean')
    .addColumn('skip_consent', 'boolean')
    .addColumn('enable_end_session', 'boolean')
    .addColumn('subject_type', 'text')
    .addColumn('scopes', 'jsonb')
    .addColumn('client_credentials_scopes', 'jsonb')
    .addColumn('user_id', 'text')
    .addColumn('created_at', 'timestamptz')
    .addColumn('updated_at', 'timestamptz')
    .addColumn('name', 'text')
    .addColumn('uri', 'text')
    .addColumn('icon', 'text')
    .addColumn('contacts', 'jsonb')
    .addColumn('tos', 'text')
    .addColumn('policy', 'text')
    .addColumn('software_id', 'text')
    .addColumn('software_version', 'text')
    .addColumn('software_statement', 'text')
    .addColumn('redirect_uris', 'jsonb', required)
    .addColumn('post_logout_redirect_uris', 'jsonb')
    .addColumn('backchannel_logout_uri', 'text')
    .addColumn('backchannel_logout_session_required', 'boolean')
    .addColumn('token_endpoint_auth_method', 'text')
    .addColumn('application_type', 'text')
    .addColumn('jwks', 'text')
    .addColumn('jwks_uri', 'text')
    .addColumn('grant_types', 'jsonb')
    .addColumn('response_types', 'jsonb')
    .addColumn('require_pkce', 'boolean')
    .addColumn('dpop_bound_access_tokens', 'boolean')
    .addColumn('reference_id', 'text')
    .addColumn('metadata', 'jsonb')
    .execute()
  await database.schema
    .createTable('oauth_resource')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('identifier', 'text', (column) => column.notNull().unique())
    .addColumn('name', 'text', required)
    .addColumn('access_token_ttl', 'integer')
    .addColumn('refresh_token_ttl', 'integer')
    .addColumn('signing_algorithm', 'text')
    .addColumn('signing_key_id', 'text')
    .addColumn('allowed_scopes', 'jsonb')
    .addColumn('custom_claims', 'jsonb')
    .addColumn('dpop_bound_access_tokens_required', 'boolean')
    .addColumn('disabled', 'boolean')
    .addColumn('created_at', 'timestamptz')
    .addColumn('updated_at', 'timestamptz')
    .addColumn('policy_version', 'integer')
    .addColumn('metadata', 'jsonb')
    .execute()
  await database.schema
    .createTable('oauth_client_resource')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('client_id', 'text', clientReference)
    .addColumn('resource_id', 'text', (column) =>
      column.notNull().references('oauth_resource.identifier').onDelete('cascade')
    )
    .addColumn('metadata', 'jsonb')
    .addColumn('created_at', 'timestamptz')
    .addUniqueConstraint('oauth_client_resource_client_id_resource_id_key', [
      'client_id',
      'resource_id'
    ])
    .execute()
  await database.schema
    .createTable('oauth_refresh_token')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('token', 'text', (column) => column.notNull().unique())
    .addColumn('client_id', 'text', clientReference)
    .addColumn('session_id', 'text')
    .addColumn('user_id', 'text', required)
    .addColumn('reference_id', 'text')
    .addColumn('authorization_code_id', 'text')
    .addColumn('resources', 'jsonb')
    .addColumn('requested_user_info_claims', 'jsonb')
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('created_at', 'timestamptz', required)
    .addColumn('revoked', 'timestamptz')
    .addColumn('rotated_at', 'timestamptz')
    .addColumn('rotation_replay_response', 'text')
    .addColumn('rotation_replay_expires_at', 'timestamptz')
    .addColumn('auth_time', 'timestamptz')
    .addColumn('confirmation', 'jsonb')
    .addColumn('scopes', 'jsonb', required)
    .execute()
  await database.schema
    .createTable('oauth_access_token')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('token', 'text', (column) => column.notNull().unique())
    .addColumn('client_id', 'text', clientReference)
    .addColumn('session_id', 'text')
    .addColumn('user_id', 'text')
    .addColumn('reference_id', 'text')
    .addColumn('authorization_code_id', 'text')
    .addColumn('resources', 'jsonb')
    .addColumn('requested_user_info_claims', 'jsonb')
    .addColumn('refresh_id', 'uuid', (column) =>
      column.references('oauth_refresh_token.id').onDelete('cascade')
    )
    .addColumn('expires_at', 'timestamptz', required)
    .addColumn('created_at', 'timestamptz', required)
    .addColumn('revoked', 'timestamptz')
    .addColumn('confirmation', 'jsonb')
    .addColumn('scopes', 'jsonb', required)
    .execute()
  await database.schema
    .createTable('oauth_consent')
    .addColumn('id', 'uuid', generatedID)
    .addColumn('client_id', 'text', clientReference)
    .addColumn('user_id', 'text')
    .addColumn('reference_id', 'text')
    .addColumn('resources', 'jsonb')
    .addColumn('requested_user_info_claims', 'jsonb')
    .addColumn('scopes', 'jsonb', required)
    .addColumn('created_at', 'timestamptz', required)
    .addColumn('updated_at', 'timestamptz', required)
    .execute()
  await database.schema
    .createTable('oauth_client_assertion')
    .addColumn('id', 'text', (column) => column.primaryKey())
    .addColumn('expires_at', 'timestamptz', required)
    .execute()
  await database.schema
    .createTable('oauth_workspace_choice')
    .addColumn('session_id', 'text', (column) => column.primaryKey())
    .addColumn('user_id', 'text', required)
    .addColumn('workspace_id', 'uuid', (column) =>
      column.notNull().references('workspace.id').onDelete('cascade')
    )
    .addColumn('chosen_at', 'timestamptz', now)
    .execute()
  await addIndexes(database, [
    ['oauth_client', ['user_id']],
    ['oauth_client_resource', ['resource_id']],
    ['oauth_refresh_token', ['client_id']],
    ['oauth_refresh_token', ['session_id']],
    ['oauth_refresh_token', ['user_id']],
    ['oauth_refresh_token', ['authorization_code_id']],
    ['oauth_access_token', ['client_id']],
    ['oauth_access_token', ['session_id']],
    ['oauth_access_token', ['user_id']],
    ['oauth_access_token', ['authorization_code_id']],
    ['oauth_access_token', ['refresh_id']],
    ['oauth_consent', ['client_id']],
    ['oauth_consent', ['user_id']],
    ['oauth_workspace_choice', ['user_id']],
    ['oauth_workspace_choice', ['workspace_id']]
  ])
}

export async function down(database: Kysely<unknown>): Promise<void> {
  await dropTables(database, TABLES)
}
