import { describe, expect, test } from 'bun:test'

import {
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type Dialect
} from 'kysely'

import { createCloudDatabase } from '@open-pencil/cloud/server'

import { createCloudTestDatabase } from '../../helpers/database'

function testDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
}

function testDatabase() {
  return createCloudDatabase({ dialect: testDialect() })
}

describe('Cloud database', () => {
  test('runs migrations and application queries in embedded PostgreSQL', async () => {
    const runtime = await createCloudTestDatabase()
    try {
      const workspaceId = crypto.randomUUID()
      await runtime.database
        .insertInto('workspace')
        .values({
          id: workspaceId,
          name: 'Test workspace',
          slug: `test-${workspaceId}`,
          createdBy: 'user-1'
        })
        .execute()
      await runtime.database
        .insertInto('workspaceMember')
        .values({ workspaceId, userId: 'user-1', role: 'admin' })
        .execute()

      const workspace = await runtime.database
        .selectFrom('workspace')
        .innerJoin('workspaceMember', 'workspaceMember.workspaceId', 'workspace.id')
        .select(['workspace.id', 'workspace.name', 'workspaceMember.role'])
        .where('workspaceMember.userId', '=', 'user-1')
        .executeTakeFirstOrThrow()

      expect(workspace).toMatchObject({
        id: workspaceId,
        name: 'Test workspace',
        role: 'admin'
      })
    } finally {
      await runtime.close()
    }
  })

  test('uses camel-case application fields with snake-case SQL identifiers', () => {
    const database = testDatabase()
    const query = database
      .selectFrom('workspaceMember')
      .select(['workspaceId', 'userId'])
      .where('userId', '=', 'user-1')
      .compile()

    expect(query.sql).toBe(
      'select "workspace_id", "user_id" from "workspace_member" where "user_id" = $1'
    )
    expect(query.parameters).toEqual(['user-1'])
  })

  test('compiles immutable revision insertion against PostgreSQL', () => {
    const database = testDatabase()
    const query = database
      .insertInto('documentRevision')
      .values({
        id: '01900000-0000-7000-8000-000000000001',
        documentId: '01900000-0000-7000-8000-000000000002',
        parentRevisionId: null,
        storageObjectId: '01900000-0000-7000-8000-000000000003',
        createdBy: 'user-1'
      })
      .compile()

    expect(query.sql).toContain('insert into "document_revision"')
    expect(query.sql).toContain('"storage_object_id"')
  })
})
