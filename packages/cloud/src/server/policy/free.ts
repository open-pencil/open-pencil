import {
  deploymentTechnicalLimits,
  parseCloudDeploymentSource
} from '#cloud/server/config/deployment'
import { technicalLimitsSchema } from '#cloud/server/config/schema'
import * as v from 'valibot'

import { StaticEntitlementSource } from './entitlements'
import { createDefaultCloudPolicy } from './policy'
import { EntitlementOpenFeatureProvider } from './provider'
import { resolveEntitlements, type PlanEntitlements } from './service'
import { staticEntitlementsFromTOML, staticEntitlementValues } from './static'

/**
 * What an account without a plan has on a deployment, from its TOML alone: its entitlements over
 * Cloud's defaults, within its technical limits, as the server would answer that account. It
 * needs no secrets, so a site can show a deployment's free plan from the file it runs with.
 */
export async function deploymentFreeEntitlements(source: string): Promise<PlanEntitlements> {
  const config = parseCloudDeploymentSource(source)
  const limits = v.parse(technicalLimitsSchema, deploymentTechnicalLimits(config))
  const values = config.entitlements
    ? staticEntitlementValues(staticEntitlementsFromTOML(config.entitlements))
    : {}
  const policy = createDefaultCloudPolicy(
    new EntitlementOpenFeatureProvider(new StaticEntitlementSource(values))
  )
  return resolveEntitlements(
    policy,
    { targetingKey: 'free', subjectType: 'user', deploymentMode: config.deployment.mode },
    limits.maximumUploadBytes,
    limits.maximumConnectionsPerRoom
  )
}
