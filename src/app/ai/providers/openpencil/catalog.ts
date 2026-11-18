import type { ChatModel, ServiceCatalog } from '@open-pencil/cloud/contract'
import type { ModelOption } from '@open-pencil/core/constants'

/** A model Cloud's AI service offers, as the app describes models. */
export function cloudCatalogModel(model: ChatModel): ModelOption & {
  capabilities: ('tools' | 'vision')[]
} {
  return {
    id: model.id,
    name: model.label,
    capabilities: [
      ...(model.capabilities.tools ? (['tools'] as const) : []),
      ...(model.capabilities.vision ? (['vision'] as const) : [])
    ]
  }
}

/** The models Cloud's AI service offers, as the model picker lists them. */
export function cloudCatalogModels(catalog: ServiceCatalog): ModelOption[] {
  return catalog.models.map(cloudCatalogModel)
}
