import type { ServiceCatalog } from '@open-pencil/cloud/contract'
import type { ModelOption } from '@open-pencil/core/constants'

/** The models Cloud's AI service offers, as the model picker lists them. */
export function cloudCatalogModels(catalog: ServiceCatalog): ModelOption[] {
  return catalog.models.map((model) => ({
    id: model.id,
    name: model.label,
    capabilities: [
      ...(model.capabilities.tools ? (['tools'] as const) : []),
      ...(model.capabilities.vision ? (['vision'] as const) : [])
    ]
  }))
}
