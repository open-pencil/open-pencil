import { isValid as isBase64 } from 'js-base64'
import * as v from 'valibot'

export const cloudAccountStateSchema = v.picklist(['active', 'pending', 'rejected', 'revoked'])
export const cloudIdentitySchema = v.object({
  userId: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
  /** The account's picture, such as one a social provider gave it. */
  image: v.optional(v.nullable(v.string())),
  deploymentRole: v.optional(v.picklist(['user', 'admin']))
})

export const cloudAccountStatusResponseSchema = v.object({
  user: cloudIdentitySchema,
  state: cloudAccountStateSchema
})

export const cloudAuthenticationProviderSchema = v.picklist(['credential', 'google', 'apple'])
export const cloudAuthenticationMethodSchema = v.object({
  id: v.string(),
  provider: cloudAuthenticationProviderSchema,
  createdAt: v.string(),
  canUnlink: v.boolean()
})
export const cloudAuthenticationMethodsResponseSchema = v.object({
  methods: v.array(cloudAuthenticationMethodSchema),
  availableSocialProviders: v.array(v.picklist(['google', 'apple']))
})
export const cloudPasswordChangeSchema = v.object({
  currentPassword: v.string(),
  newPassword: v.string()
})
export const cloudSocialLinkSchema = v.object({
  provider: v.picklist(['google', 'apple']),
  callbackURL: v.pipe(v.string(), v.url())
})
export const cloudSocialLinkResponseSchema = v.object({ url: v.pipe(v.string(), v.url()) })
export const cloudUnlinkAuthenticationMethodSchema = v.object({ methodId: v.string() })
export const accountSecurityErrorCodeSchema = v.picklist([
  'current_password_invalid',
  'password_too_short',
  'password_too_long',
  'last_authentication_method',
  'session_not_fresh',
  'authentication_method_failed',
  'email_unchanged',
  'email_change_unavailable',
  'current_session',
  'picture_invalid'
])
export const accountSecurityErrorResponseSchema = v.object({
  error: v.object({ code: accountSecurityErrorCodeSchema })
})

export const cloudMFAStatusSchema = v.object({
  required: v.boolean(),
  enabled: v.boolean(),
  totpEnabled: v.boolean(),
  assured: v.boolean(),
  totpAvailable: v.boolean(),
  passkeysAvailable: v.boolean(),
  recoveryCodesAvailable: v.boolean()
})
export const cloudMFAStatusResponseSchema = v.object({ mfa: cloudMFAStatusSchema })
export const cloudMFAEnableSchema = v.object({ password: v.optional(v.string()) })
export const cloudMFAEnableResponseSchema = v.object({
  totpURI: v.string(),
  backupCodes: v.array(v.string())
})
export const cloudMFAVerifySchema = v.object({ code: v.pipe(v.string(), v.trim(), v.minLength(1)) })
export const cloudMFAVerifyResponseSchema = v.object({ ok: v.literal(true) })
export const cloudMFARecoveryCodesResponseSchema = v.object({ backupCodes: v.array(v.string()) })
export const cloudPasskeySchema = v.object({
  id: v.string(),
  name: v.nullish(v.string()),
  createdAt: v.string()
})
export const cloudPasskeysResponseSchema = v.object({ passkeys: v.array(cloudPasskeySchema) })
export const cloudPasskeyDeleteSchema = v.object({ id: v.string() })

export function parseCloudMFAEnable(input: unknown) {
  return v.parse(cloudMFAEnableSchema, input)
}
export function parseCloudMFAVerify(input: unknown) {
  return v.parse(cloudMFAVerifySchema, input)
}
export function parseCloudPasskeyDelete(input: unknown) {
  return v.parse(cloudPasskeyDeleteSchema, input)
}
export function parseCloudPasswordChange(input: unknown) {
  return v.parse(cloudPasswordChangeSchema, input)
}
export function parseCloudSocialLink(input: unknown) {
  return v.parse(cloudSocialLinkSchema, input)
}
export function parseCloudUnlinkAuthenticationMethod(input: unknown) {
  return v.parse(cloudUnlinkAuthenticationMethodSchema, input)
}

export const cloudAccountMutationResponseSchema = v.object({ ok: v.literal(true) })

/** Who an account belongs to, as the portal shows it. */
export const cloudPersonSchema = v.object({
  id: v.string(),
  name: v.string(),
  email: v.pipe(v.string(), v.email()),
  /** The address of the account's picture, which the server serves; null shows initials. */
  image: v.nullable(v.string())
})
/** What a person can see and change about themselves. */
export const cloudProfileSchema = v.object({
  ...cloudPersonSchema.entries,
  createdAt: v.string(),
  /** Whether the server can send the verification a new email address needs. */
  emailChangeAvailable: v.boolean()
})
export const cloudProfileResponseSchema = v.object({ profile: cloudProfileSchema })
export const cloudProfileUpdateSchema = v.object({
  name: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(100))
})
/** The largest picture an account may upload, once the page has cropped and shrunk it. */
export const CLOUD_PICTURE_MAX_BYTES = 256 * 1024
/** The width and height a page shrinks a picture to before it uploads it. */
export const CLOUD_PICTURE_SIZE = 256
export const cloudPictureUploadSchema = v.object({
  /** The picture's PNG or JPEG bytes, in Base64. */
  data: v.pipe(
    v.string(),
    v.maxLength(Math.ceil(CLOUD_PICTURE_MAX_BYTES / 3) * 4),
    v.check((value) => isBase64(value))
  )
})
/** The address the account's picture is now served from. */
export const cloudPictureResponseSchema = v.object({ image: v.string() })
export const cloudEmailChangeSchema = v.object({
  newEmail: v.pipe(v.string(), v.trim(), v.toLowerCase(), v.email()),
  callbackURL: v.pipe(v.string(), v.url())
})

/** How a sign-in was made: the method it used, or the desktop app's approved code. */
export const cloudSignInMethodSchema = v.picklist([
  'password',
  'google',
  'apple',
  'passkey',
  'two-step',
  'email-link',
  'desktop',
  'other'
])
export const cloudAccountSessionSchema = v.object({
  id: v.string(),
  /** The session this request was made with. */
  current: v.boolean(),
  method: v.nullable(cloudSignInMethodSchema),
  ipAddress: v.nullable(v.string()),
  /** The browser and system the server read from the client's user agent, such as `Chrome 141`. */
  browser: v.nullable(v.string()),
  system: v.nullable(v.string()),
  createdAt: v.string(),
  lastActiveAt: v.string(),
  expiresAt: v.string()
})
export const cloudAccountSessionsResponseSchema = v.object({
  sessions: v.array(cloudAccountSessionSchema)
})
export const cloudSessionRevokeSchema = v.object({ sessionId: v.pipe(v.string(), v.minLength(1)) })
export const cloudSignInSchema = v.object({
  id: v.string(),
  method: cloudSignInMethodSchema,
  ipAddress: v.nullable(v.string()),
  /** The browser and system the server read from the client's user agent, such as `Chrome 141`. */
  browser: v.nullable(v.string()),
  system: v.nullable(v.string()),
  createdAt: v.string()
})
export const cloudSignInsResponseSchema = v.object({ signIns: v.array(cloudSignInSchema) })

export function parseCloudProfileUpdate(input: unknown) {
  return v.parse(cloudProfileUpdateSchema, input)
}
export function parseCloudPictureUpload(input: unknown) {
  return v.parse(cloudPictureUploadSchema, input)
}
export function parseCloudEmailChange(input: unknown) {
  return v.parse(cloudEmailChangeSchema, input)
}
export function parseCloudSessionRevoke(input: unknown) {
  return v.parse(cloudSessionRevokeSchema, input)
}

export type AccountSecurityErrorCode = v.InferOutput<typeof accountSecurityErrorCodeSchema>
export type CloudAuthenticationProvider = v.InferOutput<typeof cloudAuthenticationProviderSchema>
export type CloudAuthenticationMethod = v.InferOutput<typeof cloudAuthenticationMethodSchema>
export type CloudAuthenticationMethods = v.InferOutput<
  typeof cloudAuthenticationMethodsResponseSchema
>

export type CloudAccountStatus = v.InferOutput<typeof cloudAccountStatusResponseSchema>
export type CloudProfile = v.InferOutput<typeof cloudProfileSchema>
export type CloudSignInMethod = v.InferOutput<typeof cloudSignInMethodSchema>
export type CloudAccountSession = v.InferOutput<typeof cloudAccountSessionSchema>
export type CloudSignIn = v.InferOutput<typeof cloudSignInSchema>
