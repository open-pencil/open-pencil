import type * as BetterAuthEndpoints from 'better-auth/api'

/** Where Better Auth answers under the Cloud server. */
export const AUTH_BASE_PATH = '/api/auth'

/** The path an endpoint declares, whether the library exports it built or as a factory. */
type PathOf<Endpoint> = Endpoint extends { path: infer Path extends string }
  ? Path
  : Endpoint extends (...args: never) => { path: infer Path extends string }
    ? Path
    : never
type CorePaths<Names extends keyof typeof BetterAuthEndpoints> = {
  readonly [Name in Names]: PathOf<(typeof BetterAuthEndpoints)[Name]>
}

/**
 * The core endpoints whose paths Better Auth's own options need before it is built: rate limits,
 * captcha, and the hooks that record sign-ins. Plugin endpoints come from the plugin objects and
 * the rest from `auth.api`; these few are written out, and the type check holds each to the path
 * the library declares, so a renamed endpoint fails to compile.
 */
export const CORE_AUTH_PATHS: CorePaths<
  | 'callbackOAuth'
  | 'requestPasswordReset'
  | 'sendVerificationEmail'
  | 'signInEmail'
  | 'signUpEmail'
  | 'verifyEmail'
> = {
  callbackOAuth: '/callback/:id',
  requestPasswordReset: '/request-password-reset',
  sendVerificationEmail: '/send-verification-email',
  signInEmail: '/sign-in/email',
  signUpEmail: '/sign-up/email',
  verifyEmail: '/verify-email'
}

/**
 * Whether `path`, as a hook context or request has it, is the endpoint at `endpoint`. Hooks see the
 * declared pattern or the concrete path, so a `:param` segment matches any one segment.
 */
export function isAuthEndpoint(path: string | undefined, endpoint: string): boolean {
  if (!path) return false
  const actual = path.split('/')
  const expected = endpoint.split('/')
  return (
    actual.length === expected.length &&
    expected.every((segment, index) =>
      segment.startsWith(':') ? Boolean(actual[index]) : segment === actual[index]
    )
  )
}

/** The path a request for the endpoint at `endpoint` arrives at on the Cloud server. */
export function authRequestPath(endpoint: string): string {
  return `${AUTH_BASE_PATH}${endpoint}`
}
