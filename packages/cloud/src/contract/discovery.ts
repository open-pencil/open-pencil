import * as v from 'valibot'

import { cloudBillingDiscoverySchema } from './billing'
import { cloudServicesDiscoverySchema } from './services'

export const CLOUD_PROTOCOL_VERSION = '1' as const
export const CLOUD_DISCOVERY_PATH = '/.well-known/openpencil' as const

export const cloudDeploymentSchema = v.picklist(['official', 'self-hosted'])
export type CloudDeployment = v.InferOutput<typeof cloudDeploymentSchema>

export const cloudAuthenticationSchema = v.object({
  emailPassword: v.optional(
    v.object({
      signIn: v.boolean(),
      signUp: v.boolean(),
      minimumPasswordLength: v.pipe(v.number(), v.integer(), v.minValue(8)),
      captcha: v.optional(
        v.object({
          provider: v.literal('cloudflare-turnstile'),
          siteKey: v.pipe(v.string(), v.trim(), v.minLength(1))
        })
      )
    })
  ),
  socialProviders: v.array(v.picklist(['apple', 'google'])),
  enterpriseSSO: v.boolean(),
  enrollmentMode: v.optional(v.picklist(['open', 'approval', 'closed']), 'open'),
  mfa: v.optional(
    v.object({
      deploymentAdminRequired: v.boolean(),
      totp: v.boolean(),
      passkeys: v.boolean(),
      recoveryCodes: v.boolean()
    })
  )
})
export type CloudAuthentication = v.InferOutput<typeof cloudAuthenticationSchema>

export const cloudCapabilitiesSchema = v.object({
  documents: v.boolean(),
  workspaces: v.boolean(),
  collaboration: v.boolean()
})
export type CloudCapabilities = v.InferOutput<typeof cloudCapabilitiesSchema>

/** A released editor version, `major.minor.patch`. */
export const cloudEditorVersionSchema = v.pipe(v.string(), v.regex(/^\d+\.\d+\.\d+$/))

/**
 * The header desktop editors send with each request, naming their version, so a server can refuse
 * an editor older than its `minimumEditorVersion`. Browser editors leave it out: the server serves
 * them, and an older server's CORS rules would refuse a header they don't list.
 */
export const CLOUD_EDITOR_VERSION_HEADER = 'X-OpenPencil-Editor-Version' as const

function editorVersionParts(version: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)/.exec(version)
  return match ? match.slice(1).map(Number) : null
}

/**
 * Whether `version` is `minimum` or later, comparing `major.minor.patch` numerically; a prerelease
 * counts as its release. A version that isn't one, on either side, is not at least anything.
 */
export function isEditorVersionAtLeast(version: string, minimum: string): boolean {
  const have = editorVersionParts(version)
  const need = editorVersionParts(minimum)
  if (!have || !need) return false
  for (let index = 0; index < need.length; index++) {
    const difference = (have[index] ?? 0) - (need[index] ?? 0)
    if (difference !== 0) return difference > 0
  }
  return true
}

/**
 * Whether editors offer this server to everyone, and from which editor version on. Only the
 * official server's listing is read: it turns the Cloud entry points on without an editor release,
 * and an editor older than the minimum keeps them hidden.
 */
export const cloudListingSchema = v.object({ minimumEditorVersion: cloudEditorVersionSchema })
export type CloudListing = v.InferOutput<typeof cloudListingSchema>

const legalURLSchema = v.pipe(v.string(), v.url())

/**
 * The operator's legal links, which clients show at sign-up and in account pages. A server that
 * names none shows none; `requireAcceptance` means an account accepts `termsVersion` before it uses
 * the server.
 */
export const cloudLegalDiscoverySchema = v.object({
  termsURL: v.optional(legalURLSchema),
  privacyURL: v.optional(legalURLSchema),
  termsVersion: v.optional(v.string()),
  requireAcceptance: v.boolean(),
  abuseEmail: v.optional(v.pipe(v.string(), v.email())),
  minimumAge: v.optional(v.pipe(v.number(), v.integer()))
})
export type CloudLegalDiscovery = v.InferOutput<typeof cloudLegalDiscoverySchema>

/**
 * The server's community gallery: the workspace whose documents anyone may open read-only.
 * Saving to it publishes, so editors never choose it for anyone and say so when it is chosen.
 */
export const cloudCommunityDiscoverySchema = v.object({ workspaceId: v.pipe(v.string(), v.uuid()) })
export type CloudCommunityDiscovery = v.InferOutput<typeof cloudCommunityDiscoverySchema>

export const cloudDiscoverySchema = v.object({
  protocolVersion: v.literal(CLOUD_PROTOCOL_VERSION),
  deployment: cloudDeploymentSchema,
  apiURL: v.pipe(v.string(), v.url()),
  authURL: v.pipe(v.string(), v.url()),
  /** Whether the server's own editor works with files on this device without signing in. */
  localEditor: v.optional(v.boolean(), true),
  authentication: cloudAuthenticationSchema,
  capabilities: cloudCapabilitiesSchema,
  listing: v.optional(cloudListingSchema),
  /**
   * The oldest editor version the server works with. Older editors ask to be updated instead of
   * connecting, and the server refuses their requests.
   */
  minimumEditorVersion: v.optional(cloudEditorVersionSchema),
  /** The services editors reach with Cloud-signed tokens; absent when the deployment has none. */
  services: v.optional(cloudServicesDiscoverySchema),
  /** Where people manage their plan and buy credits; absent when the deployment does not bill. */
  billing: v.optional(cloudBillingDiscoverySchema),
  /** The community gallery; absent when the deployment has none. */
  community: v.optional(cloudCommunityDiscoverySchema),
  legal: v.optional(cloudLegalDiscoverySchema)
})
export type CloudDiscovery = v.InferOutput<typeof cloudDiscoverySchema>

/** The server's own address, where its editor and pages are, from its auth API's. */
export function cloudServerOrigin(discovery: CloudDiscovery): string {
  return new URL(discovery.authURL).origin
}

export function parseCloudDiscovery(input: unknown): CloudDiscovery {
  return v.parse(cloudDiscoverySchema, input)
}
