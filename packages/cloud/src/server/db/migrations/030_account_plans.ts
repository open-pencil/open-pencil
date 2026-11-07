import { CURRENT_TIMESTAMP } from '#cloud/server/db/expressions'
import type { CloudDatabase } from '#cloud/server/db/tables'
import { sql, type CreateTableBuilder, type Kysely } from 'kysely'

/**
 * Plans belong to accounts: every workspace has an owner, whose plan its limits come from, and
 * entitlements are stored per account rather than per workspace, so a person's workspaces share
 * one allowance however many they create.
 *
 * The owner is the workspace's creator while they are still a member, otherwise its
 * longest-standing admin. An account that owned several workspaces with stored entitlements
 * keeps the most recently updated ones.
 */
/** What a stored plan holds, keyed per account here and per workspace before. */
function addEntitlementColumns<Table extends string, Column extends string>(
  table: CreateTableBuilder<Table, Column>
) {
  return table
    .addColumn('values', 'jsonb', (column) => column.notNull())
    .addColumn('source', 'text', (column) => column.notNull())
    .addColumn('revision', 'integer', (column) => column.notNull().defaultTo(1))
    .addColumn('externalVersion', 'bigint')
    .addColumn('updatedAt', 'timestamptz', (column) =>
      column.notNull().defaultTo(CURRENT_TIMESTAMP)
    )
}

/** The plan's fields as `alias` holds them, for copying a plan from one table to the other. */
function entitlementFields(alias?: string) {
  const names = ['values', 'source', 'revision', 'externalVersion', 'updatedAt']
  return sql.join(names.map((name) => (alias ? sql.ref(`${alias}.${name}`) : sql.ref(name))))
}

export async function up(database: Kysely<CloudDatabase>): Promise<void> {
  await database.schema.alterTable('workspace').addColumn('ownerId', 'text').execute()
  await sql`
    update ${sql.table('workspace')} as w
    set ${sql.ref('ownerId')} = coalesce(
      (
        select m.${sql.ref('userId')} from ${sql.table('workspaceMember')} as m
        where m.${sql.ref('workspaceId')} = w.${sql.ref('id')}
          and m.${sql.ref('userId')} = w.${sql.ref('createdBy')}
      ),
      (
        select m.${sql.ref('userId')} from ${sql.table('workspaceMember')} as m
        where m.${sql.ref('workspaceId')} = w.${sql.ref('id')} and m.${sql.ref('role')} = 'admin'
        order by m.${sql.ref('createdAt')}, m.${sql.ref('userId')}
        limit 1
      ),
      w.${sql.ref('createdBy')}
    )
  `.execute(database)
  await database.schema
    .alterTable('workspace')
    .alterColumn('ownerId', (column) => column.setNotNull())
    .execute()
  await database.schema
    .createIndex('workspace_owner_index')
    .on('workspace')
    .column('ownerId')
    .execute()

  await addEntitlementColumns(
    database.schema
      .createTable('accountEntitlement')
      // Better Auth creates its tables after these migrations on a new database, so the account
      // is named without a foreign key, as `userPicture` names its owner.
      .addColumn('userId', 'text', (column) => column.primaryKey())
  ).execute()
  await sql`
    insert into ${sql.table('accountEntitlement')} (${sql.ref('userId')}, ${entitlementFields()})
    select distinct on (w.${sql.ref('ownerId')}) w.${sql.ref('ownerId')}, ${entitlementFields('e')}
    from ${sql.table('workspaceEntitlement')} as e
    join ${sql.table('workspace')} as w on w.${sql.ref('id')} = e.${sql.ref('workspaceId')}
    order by w.${sql.ref('ownerId')}, e.${sql.ref('updatedAt')} desc
  `.execute(database)
  await database.schema.dropTable('workspaceEntitlement').execute()
}

export async function down(database: Kysely<CloudDatabase>): Promise<void> {
  await addEntitlementColumns(
    database.schema
      .createTable('workspaceEntitlement')
      .addColumn('workspaceId', 'uuid', (column) =>
        column.primaryKey().references('workspace.id').onDelete('cascade')
      )
  ).execute()
  await sql`
    insert into ${sql.table('workspaceEntitlement')} (${sql.ref('workspaceId')}, ${entitlementFields()})
    select w.${sql.ref('id')}, ${entitlementFields('e')}
    from ${sql.table('accountEntitlement')} as e
    join ${sql.table('workspace')} as w on w.${sql.ref('ownerId')} = e.${sql.ref('userId')}
  `.execute(database)
  await database.schema.dropTable('accountEntitlement').execute()
  await database.schema.dropIndex('workspace_owner_index').execute()
  await database.schema.alterTable('workspace').dropColumn('ownerId').execute()
}
