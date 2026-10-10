import type {
  CloudAuthenticationMethod,
  CloudAuthenticationProvider
} from '#cloud/contract/account'
import { configuredSocialProviders, type CloudServerConfig } from '#cloud/server/config'

import type { CloudAuthAdapter } from './adapter'

const supportedProvider = (provider: string): provider is CloudAuthenticationProvider =>
  provider === 'credential' || provider === 'google' || provider === 'apple'

export function createAccountAuthenticationService(
  auth: CloudAuthAdapter,
  config: CloudServerConfig
) {
  return {
    async methods(headers: Headers) {
      const accounts = await auth.listAuthenticationMethods(headers)
      const methods = accounts.flatMap((account): CloudAuthenticationMethod[] => {
        if (!supportedProvider(account.providerId)) return []
        return [
          {
            id: account.id,
            provider: account.providerId,
            createdAt: account.createdAt.toISOString(),
            canUnlink: accounts.length > 1
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
      input: { provider: 'google' | 'apple'; callbackURL: string }
    ): Promise<string> {
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
    }
  }
}

export type AccountAuthenticationService = ReturnType<typeof createAccountAuthenticationService>
