import * as v from 'valibot'

/**
 * The `_auth/status_update` notification Claude's and Codex's ACP adapters push after
 * `initialize`, after `authenticate`, and when the login changes. Silence means the agent cannot
 * tell; `kind: 'none'` means it knows it is signed out.
 */
export const AUTH_STATUS_UPDATE_METHOD = '_auth/status_update'

const authStatusSchema = v.object({
  kind: v.picklist(['account', 'api_key', 'gateway', 'external', 'none']),
  /** Ready to show on its own: "Claude Max", "ChatGPT Pro", "Not logged in". */
  label: v.string(),
  detail: v.optional(v.string()),
  account: v.optional(
    v.object({
      email: v.optional(v.string()),
      organization: v.optional(v.string()),
      plan: v.optional(v.string())
    })
  )
})

export type AgentAuthStatus = v.InferOutput<typeof authStatusSchema>

const notificationSchema = v.object({ authStatus: authStatusSchema })

/** The status an `_auth/status_update` carries, or null for anything else. */
export function parseAuthStatusUpdate(method: string, params: unknown): AgentAuthStatus | null {
  if (method !== AUTH_STATUS_UPDATE_METHOD) return null
  const result = v.safeParse(notificationSchema, params)
  return result.success ? result.output.authStatus : null
}

export function isSignedIn(status: AgentAuthStatus): boolean {
  return status.kind !== 'none'
}

const authMethodSchema = v.object({
  id: v.string(),
  name: v.string(),
  /** `terminal` when the client runs the agent's command to sign in. */
  type: v.optional(v.string())
})

export type AgentAuthMethod = v.InferOutput<typeof authMethodSchema>

/** The auth methods an `initialize` response advertises, skipping any it cannot describe. */
export function parseAuthMethods(methods: unknown): AgentAuthMethod[] {
  if (!Array.isArray(methods)) return []
  return methods.flatMap((method) => {
    const result = v.safeParse(authMethodSchema, method)
    return result.success ? [result.output] : []
  })
}
