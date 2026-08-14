import * as v from 'valibot'

export const CLOUD_PROTOCOL_VERSION = '1' as const
export const CLOUD_DISCOVERY_PATH = '/.well-known/openpencil' as const

export const cloudDeploymentSchema = v.picklist(['official', 'self-hosted'])
export type CloudDeployment = v.InferOutput<typeof cloudDeploymentSchema>

export const cloudAuthenticationSchema = v.object({
  socialProviders: v.array(v.picklist(['apple', 'google'])),
  enterpriseSSO: v.boolean()
})
export type CloudAuthentication = v.InferOutput<typeof cloudAuthenticationSchema>

export const cloudCapabilitiesSchema = v.object({
  documents: v.boolean(),
  workspaces: v.boolean(),
  collaboration: v.boolean()
})
export type CloudCapabilities = v.InferOutput<typeof cloudCapabilitiesSchema>

export const cloudDiscoverySchema = v.object({
  protocolVersion: v.literal(CLOUD_PROTOCOL_VERSION),
  deployment: cloudDeploymentSchema,
  apiURL: v.pipe(v.string(), v.url()),
  authURL: v.pipe(v.string(), v.url()),
  authentication: cloudAuthenticationSchema,
  capabilities: cloudCapabilitiesSchema
})
export type CloudDiscovery = v.InferOutput<typeof cloudDiscoverySchema>

export function parseCloudDiscovery(input: unknown): CloudDiscovery {
  return v.parse(cloudDiscoverySchema, input)
}
