import type { CloudServerConfig } from '#cloud/server/config'

export type { CloudAuthAdapter } from './adapter'
export { createBetterAuthAdapter } from './factory'
export { createCloudSessionResolver, type CloudActor, type CloudSessionResolver } from './session'
export { workspaceAccessControl, workspaceRoles, workspaceStatements } from './workspace-access'

export function configuredSocialProviders(config: CloudServerConfig): Array<'apple' | 'google'> {
  return [
    ...(config.appleClientId ? (['apple'] as const) : []),
    ...(config.googleClientId ? (['google'] as const) : [])
  ]
}
