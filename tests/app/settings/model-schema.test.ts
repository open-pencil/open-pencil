import { expect, test } from 'bun:test'

import * as v from 'valibot'

import {
  modelProfileSchema,
  type ModelProfileValidationContext
} from '@/app/ai/models/settings/profile-editor/schema'

const messages = {
  requiredField: 'Required',
  invalidURL: 'Invalid URL',
  designToolsRequired: 'Tools required'
}
const context: ModelProfileValidationContext = {
  customModel: false,
  providerKind: 'api',
  supportsCustomBaseURL: false,
  design: true,
  intent: 'save'
}
const values = {
  name: 'Design',
  modelID: 'known-model',
  customModelID: '',
  baseURL: '',
  credential: false,
  cloudWorkspace: '',
  tools: true
}

function errors(options: Partial<ModelProfileValidationContext>, input = values) {
  const result = v.safeParse(modelProfileSchema({ ...context, ...options }, messages), input)
  return result.success ? {} : v.flatten(result.issues).nested
}

test('model requirements attach to the active field without fallback to an inactive model ID', () => {
  expect(errors({}, { ...values, modelID: '' })).toEqual({ modelID: ['Required'] })
  expect(errors({ customModel: true })).toEqual({ customModelID: ['Required'] })
  expect(
    errors({ customModel: true }, { ...values, modelID: '', customModelID: 'custom' })
  ).toEqual({})
})

test('tool support errors are forwarded by the schema to the active model field', () => {
  expect(errors({}, { ...values, tools: false })).toEqual({ modelID: ['Tools required'] })
  expect(
    errors({ customModel: true }, { ...values, customModelID: 'custom', tools: false })
  ).toEqual({ customModelID: ['Tools required'] })
  expect(errors({ design: false }, { ...values, tools: false })).toEqual({})
})

test('independent field errors survive a failed tool-support rule', () => {
  expect(errors({}, { ...values, name: '', tools: false })).toEqual({
    name: ['Required'],
    modelID: ['Tools required']
  })
})

test('Pi may leave the model empty to use the default model set in Pi', () => {
  expect(errors({ providerKind: 'harness' }, { ...values, modelID: '' })).toEqual({})
  expect(errors({ providerKind: 'harness', intent: 'test' }, { ...values, modelID: '' })).toEqual(
    {}
  )
})

test('OpenPencil Cloud needs a workspace and a model, but no key', () => {
  const cloud = { providerKind: 'cloud' as const, intent: 'test' as const }
  expect(errors(cloud, { ...values, modelID: '', cloudWorkspace: '' })).toEqual({
    modelID: ['Required'],
    cloudWorkspace: ['Required']
  })
  expect(errors(cloud, { ...values, cloudWorkspace: 'workspace' })).toEqual({})
})
