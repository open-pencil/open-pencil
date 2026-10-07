import * as v from 'valibot'

import {
  requiredSetting,
  requiredSettingsURL,
  type SettingsValidationMessages
} from '@/app/settings/validation/schema'

export interface ModelProfileValidationContext {
  customModel: boolean
  providerKind: 'api' | 'acp' | 'harness'
  supportsCustomBaseURL: boolean
  design: boolean
  intent: 'save' | 'test'
}

export interface ModelProfileValidationMessages extends SettingsValidationMessages {
  designToolsRequired: string
}

export function modelProfileSchema(
  context: ModelProfileValidationContext,
  messages: ModelProfileValidationMessages
) {
  const modelField = context.customModel ? 'customModelID' : 'modelID'
  // Agents choose their own model, and Pi falls back to the default model set in Pi.
  const requiresAPI = context.providerKind === 'api'
  const requiresModel = requiresAPI
  return v.pipe(
    v.object({
      name: context.intent === 'save' ? requiredSetting(messages.requiredField) : v.string(),
      modelID:
        requiresModel && !context.customModel
          ? requiredSetting(messages.requiredField)
          : v.string(),
      customModelID:
        requiresModel && context.customModel ? requiredSetting(messages.requiredField) : v.string(),
      baseURL:
        requiresAPI && context.supportsCustomBaseURL ? requiredSettingsURL(messages) : v.string(),
      credential:
        requiresAPI && context.intent === 'test'
          ? v.pipe(
              v.boolean(),
              v.check((value: boolean) => value, messages.requiredField)
            )
          : v.boolean(),
      tools: v.boolean()
    }),
    v.forward(
      v.partialCheck(
        [['tools']],
        ({ tools }) => context.intent !== 'save' || !context.design || tools,
        messages.designToolsRequired
      ),
      [modelField]
    )
  )
}
