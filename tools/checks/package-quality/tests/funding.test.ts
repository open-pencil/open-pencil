import { describe, expect, test } from 'bun:test'

import { FUNDING_URL, validateFunding } from '#package-quality/checks/funding'

const manifest = { name: '@open-pencil/example', version: '1.0.0' }
const fork = { name: '@open-pencil/taffy', version: '1.0.0' }

describe('funding metadata', () => {
  test('requires the funding URL on our own packages', () => {
    expect(validateFunding({ ...manifest, funding: FUNDING_URL })).toEqual([])
    expect(validateFunding(manifest).map(({ message }) => message)).toEqual([
      `must be ${FUNDING_URL}`
    ])
    expect(validateFunding({ ...manifest, funding: 'https://example.com' })).toHaveLength(1)
  })

  test('rejects funding on forks and thin wrappers', () => {
    expect(validateFunding(fork)).toEqual([])
    expect(
      validateFunding({ ...fork, funding: FUNDING_URL }).map(({ message }) => message)
    ).toEqual(['must be omitted: a build of the Taffy layout engine'])
  })
})
