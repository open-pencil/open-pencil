import type { Ref } from 'vue'

import {
  aiModelSettings,
  isAgentModelProfile,
  modelProfile,
  setModelRoleAssignment,
  type AIModelRole,
  type OptionalAIModelRole
} from '@/app/ai/models'
export function useModelRoleAssignments(
  ai: Readonly<Ref<{ modelRoleUseDesign: string; noModel: string }>>
) {
  const SAME_AS_DESIGN = '__design__'
  const NO_MODEL = '__none__'
  function assignmentValue(role: AIModelRole): string {
    const assignment = aiModelSettings.value.assignments[role]
    if (assignment === null) return NO_MODEL
    return assignment === 'design' ? SAME_AS_DESIGN : assignment
  }
  function optionsForRole(role: AIModelRole) {
    const profiles = aiModelSettings.value.models
      .filter((profile) => {
        if (role === 'design') return profile.capabilities.includes('tools')
        if (isAgentModelProfile(profile)) return false
        if (role === 'vision') return profile.capabilities.includes('vision')
        return true
      })
      .map((profile) => ({ value: profile.id, label: profile.name }))
    if (role === 'design') return profiles
    const design = modelProfile(aiModelSettings.value.assignments.design)
    const canInherit =
      !isAgentModelProfile(design) && (role !== 'vision' || design?.capabilities.includes('vision'))
    return [
      ...(canInherit ? [{ value: SAME_AS_DESIGN, label: ai.value.modelRoleUseDesign }] : []),
      { value: NO_MODEL, label: ai.value.noModel },
      ...profiles
    ]
  }
  function updateAssignment(role: AIModelRole, value: string): void {
    if (role === 'design') {
      const profile = modelProfile(value)
      if (profile) setModelRoleAssignment('design', profile.id)
      return
    }
    if (value === NO_MODEL) {
      setModelRoleAssignment(role as OptionalAIModelRole, null)
      return
    }
    if (value === SAME_AS_DESIGN) {
      setModelRoleAssignment(role as OptionalAIModelRole, 'design')
      return
    }
    const profile = modelProfile(value)
    if (profile) setModelRoleAssignment(role as OptionalAIModelRole, profile.id)
  }

  return { assignmentValue, optionsForRole, updateAssignment }
}
