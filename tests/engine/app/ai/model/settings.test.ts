import { expect, test } from 'bun:test'

import { ref } from 'vue'

import { aiModelSettings } from '@/app/ai/models'
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
