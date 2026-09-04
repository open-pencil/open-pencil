import * as v from 'valibot'

export const cloudAccountStateSchema = v.picklist(['active', 'pending', 'rejected', 'revoked'])
export const cloudIdentitySchema = v.object({
  userId: v.string(),
  email: v.pipe(v.string(), v.email()),
  name: v.string(),
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
  'authentication_method_failed'
])
export const accountSecurityErrorResponseSchema = v.object({
  error: v.object({ code: accountSecurityErrorCodeSchema })
})

export const cloudMFAStatusSchema = v.object({
  required: v.boolean(),
  enabled: v.boolean(),
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
  name: v.optional(v.string()),
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

export type AccountSecurityErrorCode = v.InferOutput<typeof accountSecurityErrorCodeSchema>
export type CloudAuthenticationProvider = v.InferOutput<typeof cloudAuthenticationProviderSchema>
export type CloudAuthenticationMethod = v.InferOutput<typeof cloudAuthenticationMethodSchema>
export type CloudAuthenticationMethods = v.InferOutput<
  typeof cloudAuthenticationMethodsResponseSchema
>

export type CloudAccountStatus = v.InferOutput<typeof cloudAccountStatusResponseSchema>
