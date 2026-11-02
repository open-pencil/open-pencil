import { describe, expect, test } from 'bun:test'

import type { RecoverySnapshotMeta } from '@/app/document/recovery'
import { crashedSessionsWithoutCopies, recoverableSnapshots } from '@/app/tabs/recovery'

function snapshot(id: string, sessionId: string): RecoverySnapshotMeta {
  return {
    id,
    sessionId,
    documentName: id,
    updatedAt: '2026-11-01T12:00:00.000Z',
    byteLength: 1,
    formatVersion: 1
  }
}

describe('recoverable snapshots', () => {
  const sessions = { live: new Set(['running']), crashed: new Set(['crashed']) }

  test('lists copies no running session holds, marking those of a crashed one', () => {
    const listed = recoverableSnapshots(
      [snapshot('lost', 'crashed'), snapshot('kept', 'closed'), snapshot('editing', 'running')],
      sessions,
      new Set()
    )
    expect(listed.map(({ id, crashed }) => [id, crashed])).toEqual([
      ['lost', true],
      ['kept', false]
    ])
  })

  test('forgets a crashed session only once no copy it wrote is left', () => {
    const crashed = { live: new Set<string>(), crashed: new Set(['restored', 'still-lost']) }
    expect([...crashedSessionsWithoutCopies([snapshot('lost', 'still-lost')], crashed)]).toEqual([
      'restored'
    ])
  })

  test('leaves out a copy a tab has open again', () => {
    expect(
      recoverableSnapshots([snapshot('lost', 'crashed')], sessions, new Set(['lost']))
    ).toEqual([])
  })
})
