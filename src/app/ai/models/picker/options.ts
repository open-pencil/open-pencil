import type { ModelOption } from '@open-pencil/core/constants'

export interface ModelPickerLabels {
  recommendedModels: string
  latestModels: string
  allModels: string
  latest: string
}

const LATEST_MODEL_COUNT = 8

export function modelPickerOptions(
  models: readonly ModelOption[],
  recommendations: readonly ModelOption[],
  labels: ModelPickerLabels
) {
  const recommendedIds = new Set(recommendations.map((model) => model.id))
  const latestIds = new Set(
    models
      .filter((model) => !recommendedIds.has(model.id) && model.releaseDate)
      .slice(0, LATEST_MODEL_COUNT)
      .map((model) => model.id)
  )
  return models.map((model) => {
    let group = labels.allModels
    if (recommendedIds.has(model.id)) group = labels.recommendedModels
    else if (latestIds.has(model.id)) group = labels.latestModels
    return {
      value: model.id,
      label: model.name,
      description: model.id,
      meta: model.tag ?? (latestIds.has(model.id) ? labels.latest : undefined),
      group
    }
  })
}
