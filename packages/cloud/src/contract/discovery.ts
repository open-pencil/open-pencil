import compareVersions from 'semver/functions/compare.js'
import parseVersion from 'semver/functions/parse.js'
import * as v from 'valibot'

import { isKnownSocialProvider } from './account'
import { cloudBillingDiscoverySchema } from './billing'
import { cloudServicesDiscoverySchema } from './services'

export const CLOUD_PROTOCOL_VERSION = '1' as const
export const CLOUD_DISCOVERY_PATH = '/.well-known/openpencil' as const

export const cloudDeploymentSchema = v.picklist(['official', 'self-hosted'])
export type CloudDeployment = v.InferOutput<typeof cloudDeploymentSchema>

/**
 * The server's sign-in providers that this editor knows. A newer server may offer one this editor
 * has no button for; it is left out rather than failing discovery, so the editor still connects.
 */
const socialProvidersSchema = v.pipe(
  v.array(v.string()),
  v.transform((providers) => providers.filter(isKnownSocialProvider))
)

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
  socialProviders: socialProvidersSchema,
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
  collaboration: v.boolean(),
  /**
   * Whether other sites may show this server's shared and community documents in a frame, at
   * `/embed/…`; servers from before embeds leave it out.
   */
  embedding: v.optional(v.boolean(), false)
})
export type CloudCapabilities = v.InferOutput<typeof cloudCapabilitiesSchema>

/**
 * An editor version, as SemVer: a release such as `0.18.0`, or a pre-release such as
 * `0.18.0-beta.2` or a nightly's `0.18.0-nightly.20261116`.
 *
 * Editors before 0.18.0 accept only `major.minor.patch` here and fail discovery on anything else,
 * so a server names a pre-release minimum only once its minimum is already 0.18.0 or later.
 */
export const cloudEditorVersionSchema = v.pipe(
  v.string(),
  v.check(isSemVer, 'Expected a SemVer version')
)

/**
 * Whether the text is exactly a SemVer version, build metadata included: semver's own parse also
 * takes a `v` prefix or spaces, which a version here never has.
 */
function isSemVer(value: string): boolean {
  const parsed = parseVersion(value)
  if (!parsed) return false
  const build = parsed.build.length > 0 ? `+${parsed.build.join('.')}` : ''
  return `${parsed.version}${build}` === value
}

/**
 * The header desktop editors send with each request, naming their version, so a server can refuse
 * an editor older than its `minimumEditorVersion`. Browser editors leave it out: the server serves
 * them, and an older server's CORS rules would refuse a header they don't list.
 */
export const CLOUD_EDITOR_VERSION_HEADER = 'X-OpenPencil-Editor-Version' as const

/**
 * Whether `version` is `minimum` or later, in SemVer order: a pre-release comes before its
 * release, so `0.18.0-beta.2` is not at least `0.18.0`; a release's nightlies come after its
 * betas and order by date. To admit a release's pre-releases, name the earliest one, such as
 * `0.18.0-beta.1`, or `0.18.0-nightly.20261116` for nightlies from that day on. A
 * version that isn't SemVer, on either side, is not at least anything.
 */
export function isEditorVersionAtLeast(version: string, minimum: string): boolean {
  if (!isSemVer(version) || !isSemVer(minimum)) return false
  return compareVersions(version, minimum) >= 0
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

/** A web address a page may link or load: `http` or `https` only, never a script or data URL. */
const webURLSchema = v.pipe(
  v.string(),
  v.url(),
  v.check((value) => ['http:', 'https:'].includes(new URL(value).protocol))
)

/**
 * How a self-hosted server names itself on its public pages: the operator's name and logo in the
 * bar, and where its people get help. The official server is OpenPencil's own and names none.
 */
export const cloudBrandingSchema = v.object({
  name: v.optional(v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(80))),
  logoURL: v.optional(webURLSchema),
  helpURL: v.optional(webURLSchema)
})
export type CloudBranding = v.InferOutput<typeof cloudBrandingSchema>

/**
 * The server's community gallery: the workspace whose documents anyone may open read-only.
 * Saving to it publishes, so editors never choose it for anyone and say so when it is chosen.
 * `tourDocumentId` is the gallery document editors open as their tour.
 */
export const cloudCommunityDiscoverySchema = v.object({
  workspaceId: v.pipe(v.string(), v.uuid()),
  tourDocumentId: v.optional(v.pipe(v.string(), v.uuid()))
})
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
  legal: v.optional(cloudLegalDiscoverySchema),
  branding: v.optional(cloudBrandingSchema)
})
export type CloudDiscovery = v.InferOutput<typeof cloudDiscoverySchema>

/** The server's own address, where its editor and pages are, from its auth API's. */
export function cloudServerOrigin(discovery: CloudDiscovery): string {
  return new URL(discovery.authURL).origin
}

export function parseCloudDiscovery(input: unknown): CloudDiscovery {
  return v.parse(cloudDiscoverySchema, input)
}
