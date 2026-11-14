import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { joinURL } from 'ufo'
import * as v from 'valibot'

import {
  billingCatalogSchema,
  type BillingCatalog,
  type ServiceCatalog,
  CLOUD_BILLING_API_PATHS,
  CLOUD_SERVICES_API_PATHS,
  serviceCatalogSchema
} from '@open-pencil/cloud/contract'
import {
  deploymentFreeEntitlements,
  parseCloudDeploymentSource,
  type PlanEntitlements
} from '@open-pencil/cloud/server'

/**
 * What the hosted service offers, read when the site is built: the free plan from the deployment
 * file it runs with, and what billing sells and services charge from their catalogs, or `null`
 * when the build could not read one, so the page leaves that part out.
 */
export type Pricing = {
  free: PlanEntitlements
  catalog: BillingCatalog | null
  services: ServiceCatalog | null
}

declare const data: Pricing
export { data }

/** The deployment file the hosted service runs with, in the Cloud package's own folder. */
const PRODUCTION_DEPLOYMENT = join(
  dirname(fileURLToPath(import.meta.resolve('@open-pencil/cloud/package.json'))),
  'deploy/openpencil/production/openpencil-cloud.toml'
)

/** A stalled response takes the same fallback as a failed one rather than hold up the build. */
const CATALOG_TIMEOUT_MS = 30_000

/** A catalog from the service at `endpoint`, or `null` when there is none or it can't be read. */
async function fetchCatalog<Schema extends v.GenericSchema>(
  name: string,
  endpoint: string | undefined,
  path: string,
  schema: Schema
): Promise<v.InferOutput<Schema> | null> {
  if (!endpoint) return null
  try {
    const response = await fetch(joinURL(endpoint, path), {
      headers: { accept: 'application/json' },
      signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS)
    })
    if (!response.ok) throw new Error(`it answered ${response.status}`)
    const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), schema), await response.text())
    if (!parsed.success) throw new Error('it sent its catalog in an unexpected shape')
    return parsed.output
  } catch (error) {
    console.warn(
      `[pricing] The ${name} catalog is unavailable, the page leaves it out: ${String(error)}`
    )
    return null
  }
}

/**
 * What the hosted service offers, read when the site is built so the page stays static: the free
 * plan from the deployment file production runs with, the plans and credit packs from the billing
 * service it names, and what credits buy from its services. Nothing here is written by hand.
 */
export default {
  async load(): Promise<Pricing> {
    const productionSource = await readFile(PRODUCTION_DEPLOYMENT, 'utf8')
    const deployment = parseCloudDeploymentSource(productionSource)
    const [free, catalog, services] = await Promise.all([
      deploymentFreeEntitlements(productionSource),
      fetchCatalog(
        'billing',
        deployment.billing?.endpoint,
        CLOUD_BILLING_API_PATHS.catalog,
        billingCatalogSchema
      ),
      fetchCatalog(
        'services',
        deployment.services?.endpoint,
        CLOUD_SERVICES_API_PATHS.catalog,
        serviceCatalogSchema
      )
    ])
    return { free, catalog, services }
  }
}
