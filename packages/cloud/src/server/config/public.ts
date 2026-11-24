import {
  CLOUD_BILLING_CONTRACT_VERSION,
  type BillingFreePlan,
  CLOUD_SERVICES_CONTRACT_VERSION,
  CLOUD_PROTOCOL_VERSION,
  parseCloudDiscovery,
  type CloudDiscovery
} from '#cloud/contract'
import { configuredSocialProviders } from '#cloud/server/auth/social-providers'
import { withoutTrailingSlash } from 'ufo'

import type { CloudServerConfig } from './schema'

/**
 * The free plan billing compares its plans with: what an account takes before billing stores its
 * own, as the deployment's default entitlements say. Services without an allowance have no monthly
 * limit, as the services token says of them too.
 */
function freePlan(config: CloudServerConfig): BillingFreePlan {
  const { storage, services } = config.defaultEntitlements ?? {}
  return {
    storageBytes: storage?.maximumBytes ?? null,
    services: services?.enabled ?? false,
    monthlyCredits: services?.monthlyCreditAllowance ?? null
  }
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
      collaboration: true,
      apps: config.oauthEnabled,
      agents: config.agentPairing
    },
    listing: config.listingMinimumEditorVersion
      ? { minimumEditorVersion: config.listingMinimumEditorVersion }
      : undefined,
    minimumEditorVersion: config.minimumEditorVersion,
    services: config.servicesEndpoint
      ? { endpoint: config.servicesEndpoint, contractVersion: CLOUD_SERVICES_CONTRACT_VERSION }
      : undefined,
    billing: config.billingEndpoint
      ? {
          endpoint: config.billingEndpoint,
          contractVersion: CLOUD_BILLING_CONTRACT_VERSION,
          freePlan: freePlan(config)
        }
      : undefined,
    community: config.community,
    branding: config.branding,
    legal: config.legal
  })
}
