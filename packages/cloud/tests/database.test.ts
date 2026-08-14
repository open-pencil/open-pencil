import { describe, expect, test } from 'bun:test'

import {
  DummyDriver,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type Dialect
} from 'kysely'

import { createCloudDatabase } from '../src/server'

function dummyPostgresDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
}

describe('Cloud database', () => {
  test('uses camel-case application fields with snake-case SQL identifiers', () => {
    const database = createCloudDatabase({ dialect: dummyPostgresDialect() })
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
    const database = createCloudDatabase({ dialect: dummyPostgresDialect() })
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
