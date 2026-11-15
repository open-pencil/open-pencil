import { describe, expect, test } from 'bun:test'

import { initialSaveChoice, type SaveDestination } from '@/app/storage/save-to/model'

const server = { id: 'cloud', label: 'cloud.example' }

function workspace(id: string, extra: Partial<SaveDestination> = {}): SaveDestination {
  return {
    key: `cloud/${id}`,
    location: { providerId: 'openpencil-cloud', profileId: 'cloud', containerId: id },
    label: id,
    kind: 'workspace',
    place: server,
    role: 'admin',
    ...extra
  }
}

const own = workspace('own')
const team = workspace('team', { role: 'editor' })
const gallery = workspace('gallery', { public: true })

describe('where Save to starts', () => {
  test('the place saved to last, else the first one the person can save to', () => {
    expect(initialSaveChoice([own, team], 'cloud/team')).toEqual({
      chosen: 'cloud/team',
      ask: true
    })
    expect(initialSaveChoice([own, team], '')).toEqual({ chosen: 'cloud/own', ask: true })
    expect(initialSaveChoice([workspace('viewer', { role: 'viewer' }), own], '').chosen).toBe(
      'cloud/own'
    )
  })

  test('saves without asking when there is one place to save to', () => {
    expect(initialSaveChoice([own], '')).toEqual({ chosen: 'cloud/own', ask: false })
  })

  test('never picks a public place on its own, even as the last one saved to', () => {
    expect(initialSaveChoice([gallery, own], 'cloud/gallery')).toEqual({
      chosen: 'cloud/own',
      ask: true
    })
    // With nowhere else, it asks with nothing chosen, so publishing is picked on purpose.
    expect(initialSaveChoice([gallery], '')).toEqual({ chosen: '', ask: true })
  })
})
