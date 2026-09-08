import type { AccountSecurityErrorCode } from '#cloud/contract'
import type { CloudIdentityResolver, CloudSessionResolver } from '#cloud/server/auth'
import { APIError } from 'better-auth'
import type { Context } from 'hono'

const ACCOUNT_SECURITY_ERROR_CODES: Record<string, AccountSecurityErrorCode> = {
  INVALID_PASSWORD: 'current_password_invalid',
  PASSWORD_TOO_SHORT: 'password_too_short',
  PASSWORD_TOO_LONG: 'password_too_long',
  FAILED_TO_UNLINK_LAST_ACCOUNT: 'last_authentication_method',
  SESSION_NOT_FRESH: 'session_not_fresh'
}

async function accountAction<Value>(operation: () => Promise<Value>, context: Context) {
  try {
    return await operation()
  } catch (error) {
    if (!(error instanceof APIError)) throw error
    return context.json(
      {
        error: {
          code:
            ACCOUNT_SECURITY_ERROR_CODES[error.body?.code ?? ''] ?? 'authentication_method_failed'
        }
      },
      error.statusCode as 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500
    )
  }
}

function completedMFAResponse(result: Response | undefined, context: Context): Response {
  if (!(result instanceof Response)) return context.json({ ok: true as const })
  if (!result.ok) return result
  const headers = new Headers(result.headers)
  headers.set('Content-Type', 'application/json')
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers })
}

export function createAccountActions(resolveSession: CloudSessionResolver) {
  return {
    accountAction,
    activeAccountAction: async <Value>(
      context: Context,
      operation: () => Promise<Value>
    ): Promise<Value | Response> => {
      if (!(await resolveSession(context.req.raw))) {
        return context.json({ error: { code: 'unauthorized' as const } }, 401)
      }
      return accountAction(operation, context)
    },
    verifiedMFAAction: async (
      context: Context,
      identityResolver: CloudIdentityResolver,
      verify: () => Promise<Response | undefined>
    ): Promise<Response> => {
      if (!(await identityResolver(context.req.raw))) {
        return context.json({ error: { code: 'unauthorized' as const } }, 401)
      }
      const result = await accountAction(verify, context)
      return completedMFAResponse(result instanceof Response ? result : undefined, context)
    }
  }
}
