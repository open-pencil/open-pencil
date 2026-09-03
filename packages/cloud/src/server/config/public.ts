import { CLOUD_PROTOCOL_VERSION, parseCloudDiscovery, type CloudDiscovery } from '#cloud/contract'

import type { CloudServerConfig } from './schema'

export function configuredSocialProviders(config: CloudServerConfig): Array<'apple' | 'google'> {
  return [
    ...(config.appleClientId ? (['apple'] as const) : []),
    ...(config.googleClientId ? (['google'] as const) : [])
  ]
}

export function cloudDiscoveryFromConfig(config: CloudServerConfig): CloudDiscovery {
  return parseCloudDiscovery({
    protocolVersion: CLOUD_PROTOCOL_VERSION,
    deployment: config.deployment,
    apiURL: new URL('/api', config.publicURL).href.replace(/\/$/, ''),
    authURL: new URL('/api/auth', config.publicURL).href.replace(/\/$/, ''),
    appURL: config.appURL ?? config.publicURL,
    authentication: {
      ...(config.emailPasswordEnabled
        ? {
            emailPassword: {
              signIn: true,
              signUp: config.emailPasswordSignUpEnabled,
              minimumPasswordLength: config.emailPasswordMinimumLength,
              ...(config.captchaProvider && config.captchaSiteKey
                ? {
                    captcha: {
                      provider: config.captchaProvider,
                      siteKey: config.captchaSiteKey
                    }
                  }
                : {})
            }
          }
        : {}),
      socialProviders: configuredSocialProviders(config),
      enterpriseSSO: false,
      enrollmentMode: config.enrollmentMode
    },
    capabilities: {
      documents: true,
      workspaces: true,
      collaboration: true
    }
  })
}
