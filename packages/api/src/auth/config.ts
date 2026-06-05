export const INKLY_API_AUTH_BASE_PATH = '/api/auth'

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
}

export interface InklyAuthConfig {
  basePath: string
  secret: string
  google: GoogleOAuthConfig | null
  warnings: string[]
}

export interface ResolveInklyAuthConfigOptions {
  env?: NodeJS.ProcessEnv
  fallbackSecret: string
}

function readEnv(value: string | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed && trimmed.length > 0 ? trimmed : null
}

export function resolveInklyAuthConfig(
  options: ResolveInklyAuthConfigOptions
): InklyAuthConfig {
  const env = options.env ?? process.env
  const warnings: string[] = []
  const authSecret = readEnv(env.INKLY_API_AUTH_SECRET)
  const googleClientId = readEnv(env.INKLY_API_GOOGLE_CLIENT_ID)
  const googleClientSecret = readEnv(env.INKLY_API_GOOGLE_CLIENT_SECRET)

  if (!authSecret) {
    warnings.push(
      '[inkly-api] INKLY_API_AUTH_SECRET is not set; falling back to the API JWT secret for Better Auth.'
    )
  }

  let google: GoogleOAuthConfig | null = null

  if (googleClientId && googleClientSecret) {
    google = {
      clientId: googleClientId,
      clientSecret: googleClientSecret
    }
  } else if (googleClientId || googleClientSecret) {
    warnings.push(
      '[inkly-api] Google OAuth is disabled because INKLY_API_GOOGLE_CLIENT_ID and INKLY_API_GOOGLE_CLIENT_SECRET must both be set.'
    )
  } else {
    warnings.push(
      '[inkly-api] Google OAuth is disabled because Google client credentials are not configured. Anonymous routes remain available.'
    )
  }

  return {
    basePath: INKLY_API_AUTH_BASE_PATH,
    secret: authSecret ?? options.fallbackSecret,
    google,
    warnings
  }
}
