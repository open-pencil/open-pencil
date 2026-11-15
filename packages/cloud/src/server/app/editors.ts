import { CLOUD_EDITOR_VERSION_HEADER, isEditorVersionAtLeast } from '#cloud/contract'
import type { MiddlewareHandler } from 'hono'

/**
 * Refuses requests from a desktop editor older than the server's minimum, which would otherwise
 * keep writing with a model the server no longer accepts. Requests that name no version, from
 * browser editors, the CLI or MCP, pass.
 */
export function requireMinimumEditor(minimum: string | undefined): MiddlewareHandler {
  return async (context, next) => {
    const version = context.req.header(CLOUD_EDITOR_VERSION_HEADER)
    if (minimum && version && !isEditorVersionAtLeast(version, minimum)) {
      return context.json(
        { error: { code: 'editor_outdated' as const }, minimumEditorVersion: minimum },
        426
      )
    }
    return next()
  }
}
