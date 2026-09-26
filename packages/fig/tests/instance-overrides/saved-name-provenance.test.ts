import { expect, test } from 'bun:test'

import fixture from './fixtures/name-provenance.json'

// Records are reduced from Figma's actual Save local copy canvas payloads.
test('saved name claims distinguish explicit equal names and component-set defaults', () => {
  const [plain, equal, custom] = fixture.oracle.names.instances
  const record = (id: string) =>
    fixture.records.find((n) => `${n.guid.sessionID}:${n.guid.localID}` === id)
  expect(record(plain.id)?.symbolData?.symbolOverrides).toEqual([])
  expect(record(equal.id)?.symbolData?.symbolOverrides[0]?.name).toBe('Original')
  expect(record(custom.id)?.symbolData?.symbolOverrides[0]?.name).toBe('Custom')
  const set = record(fixture.oracle.variants.set)
  expect(set?.isStateGroup).toBe(true)
  expect(set?.name).toBe('Control')
  expect(fixture.oracle.variants.variant.map((n) => n.name)).toEqual(['Control', 'Custom'])
  expect(fixture.oracle.variants.unrelated.map((n) => n.name)).toEqual(['Other', 'Custom'])
})
