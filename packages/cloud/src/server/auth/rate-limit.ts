import type { deviceAuthorization } from 'better-auth/plugins'

import { CORE_AUTH_PATHS } from './endpoints'

type DeviceEndpoints = ReturnType<typeof deviceAuthorization>['endpoints']

/**
 * Better Auth's request budgets, counted per client IP in the database: a general one, and tighter
 * ones for steps that send email, check passwords, or hand out desktop sign-in codes.
 */
export function authRateLimit(devices: DeviceEndpoints) {
  return {
    enabled: true,
    storage: 'database' as const,
    window: 60,
    max: 100,
    customRules: {
      [devices.deviceCode.path]: { window: 60, max: 10 },
      [devices.deviceToken.path]: { window: 60, max: 60 },
      // The plugin's own budget is 5 lookups per code lifetime (30 minutes), so reopening the
      // sign-in page a few times turned away every new code for half an hour.
      [devices.deviceVerify.path]: { window: 60, max: 20 },
      [devices.deviceApprove.path]: { window: 60, max: 10 },
      [devices.deviceDeny.path]: { window: 60, max: 10 },
      [CORE_AUTH_PATHS.signInEmail]: { window: 10, max: 3 },
      [CORE_AUTH_PATHS.signUpEmail]: { window: 10, max: 3 },
      [CORE_AUTH_PATHS.requestPasswordReset]: { window: 60, max: 3 },
      [CORE_AUTH_PATHS.sendVerificationEmail]: { window: 60, max: 3 }
    }
  }
}
