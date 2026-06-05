import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import { betterAuth } from 'better-auth'

import type { ApiDatabase } from '../db/client.js'
import * as schema from '../db/schema.js'
import { resolveInklyAuthConfig } from './config.js'

export interface InklyAuth {
  handler(request: Request): Promise<Response>
}

export interface CreateInklyAuthOptions {
  database: ApiDatabase
  env?: NodeJS.ProcessEnv
  fallbackSecret: string
  logger?: Pick<Console, 'warn'>
}

export function createInklyAuth(options: CreateInklyAuthOptions): InklyAuth {
  const config = resolveInklyAuthConfig({
    env: options.env,
    fallbackSecret: options.fallbackSecret
  })

  for (const warning of config.warnings) {
    options.logger?.warn(warning)
  }

  const auth = betterAuth({
    basePath: config.basePath,
    secret: config.secret,
    database: drizzleAdapter(options.database.db, {
      provider: 'sqlite',
      schema,
      usePlural: true
    }),
    socialProviders: config.google
      ? {
          google: {
            clientId: config.google.clientId,
            clientSecret: config.google.clientSecret
          }
        }
      : undefined
  })

  return {
    handler(request) {
      return auth.handler(request)
    }
  }
}
