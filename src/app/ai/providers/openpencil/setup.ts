import { watch } from 'vue'

import type { RoleModels, ServiceCatalog } from '@open-pencil/cloud/contract'

import {
  hasOnlyUnsetDefaultModel,
  setUpRoleModels,
  type AIModelCapability,
  type RoleModelChoice
} from '@/app/ai/models'

import { OPENPENCIL_AI_PROVIDER } from './provider'
import { HOME_CLOUD_AI, type CloudAISource } from './source'

/**
 * The model a catalog recommends for each role. A service that predates the recommendations has
 * its default model take every role, and Vision only when it reads images.
 */
export function catalogRoleModels(catalog: ServiceCatalog): RoleModels {
  if (catalog.roleModels) return catalog.roleModels
  const fallback = catalog.models.find((model) => model.id === catalog.defaultModelID)
  const id = catalog.defaultModelID
  return { design: id, review: id, fast: id, vision: fallback?.capabilities.vision ? id : null }
}

function choice(catalog: ServiceCatalog, modelID: string | null): RoleModelChoice | null {
  const model = catalog.models.find((candidate) => candidate.id === modelID)
  if (!model) return null
  const capabilities: AIModelCapability[] = []
  if (model.capabilities.tools) capabilities.push('tools')
  if (model.capabilities.vision) capabilities.push('vision')
  return { modelID: model.id, name: model.label, capabilities }
}

/**
 * Sets AI up on Cloud's service for the signed-in account, with the model its catalog recommends
 * for each role, paid for by the first workspace whose plan includes AI. Only over a fresh
 * install's unset model, so a model the person set up is never replaced. Says whether it did.
 */
export async function setUpCloudAI(cloud: CloudAISource = HOME_CLOUD_AI): Promise<boolean> {
  const identity = cloud.identity.value
  if (!identity || !hasOnlyUnsetDefaultModel()) return false
  const workspace = (await cloud.workspaces()).at(0)
  const client = workspace ? cloud.client(workspace.id) : null
  if (!workspace || !client) return false
  const catalog = await client.catalog()
  // Another sign-in, or a model the person set up meanwhile, wins over this answer.
  if (cloud.identity.value !== identity || !hasOnlyUnsetDefaultModel()) return false
  const roles = catalogRoleModels(catalog)
  const design = choice(catalog, roles.design)
  if (!design?.capabilities.includes('tools')) return false
  setUpRoleModels(
    OPENPENCIL_AI_PROVIDER,
    {
      design,
      review: choice(catalog, roles.review),
      fast: choice(catalog, roles.fast),
      vision: choice(catalog, roles.vision)
    },
    workspace.id
  )
  return true
}

/**
 * Sets AI up on Cloud whenever someone signs in to the Home server, so a Cloud plan's AI works
 * without choosing a model or entering a key. Returns what stops watching.
 */
export function watchCloudAISetup(cloud: CloudAISource = HOME_CLOUD_AI): () => void {
  return watch(
    cloud.identity,
    (identity) => {
      if (!identity) return
      setUpCloudAI(cloud).catch((error: unknown) => {
        console.warn('[Cloud AI] Could not set up the models', error)
      })
    },
    { immediate: true }
  )
}
