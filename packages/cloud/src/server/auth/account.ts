import {
  isKnownAuthenticationProvider,
  type CloudAuthenticationMethod,
  type CloudSocialProvider
} from '#cloud/contract/account'
import type { CloudServerConfig } from '#cloud/server/config'

import type { CloudAuthAdapter, SocialLinkStart } from './adapter'
import { canRemoveSignInMethod, signInProviders } from './methods'
import { configuredSocialProviders } from './social-providers'

export function createAccountAuthenticationService(
  auth: CloudAuthAdapter,
  config: CloudServerConfig
) {
  const providers = signInProviders(config)
  return {
    async methods(headers: Headers) {
      const accounts = await auth.listAuthenticationMethods(headers)
      const methods = accounts.flatMap((account): CloudAuthenticationMethod[] => {
        if (!isKnownAuthenticationProvider(account.providerId)) return []
        return [
          {
            id: account.id,
            provider: account.providerId,
            createdAt: account.createdAt.toISOString(),
            canUnlink: canRemoveSignInMethod(account, accounts, providers)
          }
        ]
      })
      return {
        methods,
        availableSocialProviders: configuredSocialProviders(config).filter(
          (provider) => !methods.some((method) => method.provider === provider)
        )
      }
    },
    async changePassword(
      headers: Headers,
      input: { currentPassword: string; newPassword: string }
    ): Promise<void> {
      await auth.changePassword(headers, input)
    },
    async startSocialLink(
      headers: Headers,
      input: { provider: CloudSocialProvider; callbackURL: string }
    ): Promise<SocialLinkStart> {
      if (!configuredSocialProviders(config).includes(input.provider)) {
        throw new Error('Authentication provider is unavailable')
      }
      const callback = new URL(input.callbackURL)
      if (callback.origin !== new URL(config.publicURL).origin) {
        throw new Error('Authentication callback origin is unavailable')
      }
      return auth.startSocialLink(headers, { ...input, callbackURL: callback.href })
    },
    async unlink(headers: Headers, methodId: string): Promise<void> {
      await auth.unlinkAuthenticationMethod(headers, methodId)
    },
    /** Asks for a new address; the link that confirms it comes back to this server's pages. */
    async changeEmail(
      headers: Headers,
      input: { newEmail: string; callbackURL: string }
    ): Promise<void> {
      const callback = new URL(input.callbackURL)
      if (callback.origin !== new URL(config.publicURL).origin) {
        throw new Error('Email change callback origin is unavailable')
      }
      await auth.changeEmail(headers, { ...input, callbackURL: callback.href })
    }
  }
}

export type AccountAuthenticationService = ReturnType<typeof createAccountAuthenticationService>
