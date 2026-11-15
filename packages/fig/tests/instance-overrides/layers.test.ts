import { expect, test } from 'bun:test'

import { ownerAssignedProperties, type AssignmentGroup } from '#fig/instance-overrides/layers'
import type { ComponentPropAssignment } from '#fig/instance-overrides/types'

function group(rank: number, ...ids: number[]): AssignmentGroup {
  return {
    rank,
    assignments: ids.map((localID) => ({ defID: { sessionID: 1, localID } }))
  }
}

test('owner-assigned properties leave out the assignments the instance drops', () => {
  // The instance's own group comes first; outer owners assign 2 and 3, and 3 is dropped, as an
  // assignment of a slot whose content frame is gone is.
  const groups = [group(0, 1), group(1, 2), group(2, 3)]
  const keeps = (assignment: ComponentPropAssignment) => assignment.defID?.localID !== 3

  expect(ownerAssignedProperties(groups, keeps)).toEqual(['1:2'])
})
