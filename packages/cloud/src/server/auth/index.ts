import type { CloudServerConfig } from '#cloud/server/config'

export type { CloudAuthAdapter } from './adapter'
export { createBetterAuthAdapter } from './factory'
export {
  createCloudIdentityResolver,
  createCloudSessionResolver,
  type CloudActor,
  type CloudIdentityResolver,
  type CloudSessionResolver
} from './session'
export type { CloudIdentity } from './adapter'
export { workspaceAccessControl, workspaceRoles, workspaceStatements } from './workspace-access'

export function configuredSocialProviders(config: CloudServerConfig): Array<'apple' | 'google'> {
  return [
    ...(config.appleClientId ? (['apple'] as const) : []),
    ...(config.googleClientId ? (['google'] as const) : [])
  ]
}
