import { describe, expect, test } from 'bun:test'

import type { BetterAuthOptions } from 'better-auth'
import {
  DummyDriver,
  Kysely,
  PostgresAdapter,
  PostgresIntrospector,
  PostgresQueryCompiler,
  type Dialect
} from 'kysely'

import {
  configuredSocialProviders,
  createBetterAuthAdapter,
  parseCloudServerConfig
} from '@open-pencil/cloud/server'
import type { CloudDatabase } from '@open-pencil/cloud/server'

function dummyPostgresDialect(): Dialect {
  return {
    createAdapter: () => new PostgresAdapter(),
    createDriver: () => new DummyDriver(),
    createIntrospector: (database) => new PostgresIntrospector(database),
    createQueryCompiler: () => new PostgresQueryCompiler()
  }
}

const baseConfig = {
  deployment: 'self-hosted',
  publicURL: 'https://pencil.example.com',
  databaseURL: 'postgresql://openpencil:secret@database/openpencil',
  authSecret: 'a-secure-auth-secret-with-at-least-32-characters',
  s3Endpoint: 'https://objects.example.com',
  s3Region: 'us-east-1',
  s3Bucket: 'openpencil',
  s3AccessKeyId: 'access-key',
  s3SecretAccessKey: 'secret-key'
}

function database(): Kysely<CloudDatabase> {
  return new Kysely<CloudDatabase>({ dialect: dummyPostgresDialect() })
}

describe('Cloud authentication', () => {
  test('keeps social providers optional for self-hosting', () => {
    const config = parseCloudServerConfig(baseConfig)
    expect(configuredSocialProviders(config)).toEqual([])
    expect(createBetterAuthAdapter(config, database()).handler).toBeFunction()
  })

  test('advertises only fully configured providers', () => {
    const config = parseCloudServerConfig({
      ...baseConfig,
      googleClientId: 'google-client',
      googleClientSecret: 'google-secret',
      appleClientId: 'apple-client',
      appleTeamId: 'apple-team',
      appleKeyId: 'apple-key',
      applePrivateKey: 'private-key-loaded-lazily'
    })
    expect(configuredSocialProviders(config)).toEqual(['apple', 'google'])
  })

  test('uses Better Auth PostgreSQL configuration without exposing it in contracts', () => {
    const options = {
      database: { db: database(), type: 'postgres' }
    } satisfies Pick<BetterAuthOptions, 'database'>
    expect(options.database.type).toBe('postgres')
  })
})
