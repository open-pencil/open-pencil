import {
  CLOUD_AI_CONTRACT_VERSION,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  type CloudDiscovery
} from '#cloud/contract'
import { withoutTrailingSlash } from 'ufo'

import type { CloudServerConfig } from './schema'

export function configuredSocialProviders(config: CloudServerConfig): Array<'apple' | 'google'> {
  return [
    ...(config.appleClientId ? (['apple'] as const) : []),
    ...(config.googleClientId ? (['google'] as const) : [])
  ]
}

export function cloudDiscoveryFromConfig(config: CloudServerConfig): CloudDiscovery {
  const authentication: CloudDiscovery['authentication'] = {
    socialProviders: configuredSocialProviders(config),
    enterpriseSSO: false,
    enrollmentMode: config.enrollmentMode
  }
  if (config.emailPasswordEnabled) {
    authentication.emailPassword = {
      signIn: true,
      signUp: config.emailPasswordSignUpEnabled,
      minimumPasswordLength: config.emailPasswordMinimumLength
    }
    if (config.captchaProvider && config.captchaSiteKey) {
      authentication.emailPassword.captcha = {
        provider: config.captchaProvider,
        siteKey: config.captchaSiteKey
      }
    }
  }
  if (config.totpEnabled || config.passkeysEnabled) {
    authentication.mfa = {
      deploymentAdminRequired: config.deploymentAdminMFARequired,
      totp: config.totpEnabled,
      passkeys: config.passkeysEnabled,
      recoveryCodes: config.totpEnabled && config.recoveryCodesEnabled
    }
  }

  return parseCloudDiscovery({
    protocolVersion: CLOUD_PROTOCOL_VERSION,
    deployment: config.deployment,
    apiURL: withoutTrailingSlash(new URL('/api', config.publicURL).href),
    authURL: withoutTrailingSlash(new URL('/api/auth', config.publicURL).href),
    localEditor: config.localEditor,
    authentication,
    capabilities: {
      documents: true,
      workspaces: true,
      collaboration: true
    },
    listing: config.listingMinimumEditorVersion
      ? { minimumEditorVersion: config.listingMinimumEditorVersion }
      : undefined,
    ai: config.aiEndpoint
      ? { endpoint: config.aiEndpoint, contractVersion: CLOUD_AI_CONTRACT_VERSION }
      : undefined,
    billing: config.billingPortalURL ? { portalURL: config.billingPortalURL } : undefined
  })
}
