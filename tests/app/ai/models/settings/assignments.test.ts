import { afterEach, beforeEach, describe, expect, test } from 'bun:test'

import { ref } from 'vue'

import {
  aiModelSettings,
  modelSettingsSnapshot,
  replaceAIModelSettings,
  type AIModelCapability,
  type AIModelProfileId,
  type AIModelRole
} from '@/app/ai/models'
import { useModelRoleAssignments } from '@/app/ai/models/settings/assignments'

test('assignment adapter round-trips disabled and inherited roles', () => {
  const previous = structuredClone({ ...aiModelSettings.value.assignments })
  const assignments = useModelRoleAssignments(
    ref({ modelRoleUseDesign: 'Use design', noModel: 'None' })
  )
  try {
    assignments.updateAssignment('review', '__none__')
    expect(aiModelSettings.value.assignments.review).toBeNull()
    expect(assignments.assignmentValue('review')).toBe('__none__')
    assignments.updateAssignment('review', '__design__')
    expect(aiModelSettings.value.assignments.review).toBe('design')
    expect(assignments.assignmentValue('review')).toBe('__design__')
    expect(assignments.optionsForRole('review').some((option) => option.value === '__none__')).toBe(
      true
    )
  } finally {
    aiModelSettings.value.assignments = previous
  }
})

describe('role options with coding agents', () => {
  const original = modelSettingsSnapshot()
  const assignments = useModelRoleAssignments(
    ref({ modelRoleUseDesign: 'Use design', noModel: 'None' })
  )

  function profile(id: AIModelProfileId, connectionId: string, capabilities: AIModelCapability[]) {
    return {
      id,
      name: id,
      connectionId,
      modelID: '',
      customModelID: '',
      maxOutputTokens: 16_384,
      thinkingLevel: 'default' as const,
      capabilities
    }
  }

  beforeEach(() => {
    const connections = ['acp:claude-code', 'harness:pi'] as const
    replaceAIModelSettings({
      version: 1,
      connections: connections.map((providerID) => ({
        id: providerID,
        providerID,
        customBaseURL: '',
        customAPIType: 'completions',
        credentialProfileId: providerID
      })),
      models: [
        profile('model-acp', 'acp:claude-code', ['tools']),
        profile('model-acp-vision', 'acp:claude-code', ['tools', 'vision']),
        profile('model-pi', 'harness:pi', ['tools'])
      ],
      assignments: { design: 'model-acp', review: null, fast: null, vision: null }
    })
  })

  afterEach(() => replaceAIModelSettings(original))

  const values = (role: AIModelRole) => assignments.optionsForRole(role).map(({ value }) => value)

  test('offer an agent for review and fast work, and for Vision once it reads images', () => {
    expect(values('review')).toEqual([
      '__design__',
      '__none__',
      'model-acp',
      'model-acp-vision',
      'model-pi'
    ])
    expect(values('fast')).toContain('model-pi')
    expect(values('vision')).toEqual(['__none__', 'model-acp-vision'])
  })

  test('let roles follow an agent Design model, Vision only if it reads images', () => {
    expect(values('vision')).not.toContain('__design__')
    assignments.updateAssignment('design', 'model-acp-vision')
    expect(values('vision')).toContain('__design__')
    assignments.updateAssignment('vision', '__design__')
    expect(assignments.assignmentValue('vision')).toBe('__design__')
    assignments.updateAssignment('fast', 'model-pi')
    expect(assignments.assignmentValue('fast')).toBe('model-pi')
  })
})
