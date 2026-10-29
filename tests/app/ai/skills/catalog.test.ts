import { describe, expect, test } from 'bun:test'

import { skillCatalog } from '@/app/ai/skills/catalog'

import { skillFixture } from '#tests/helpers/chat/skills'

describe('skillCatalog', () => {
  test('is empty when no skill is listed for the model', () => {
    expect(skillCatalog([])).toBe('')
    expect(skillCatalog([skillFixture({ modelInvocable: false })])).toBe('')
  })

  test('lists the skills the model may load, by name and description', () => {
    const catalog = skillCatalog([
      skillFixture(),
      skillFixture({ name: 'release-notes', modelInvocable: false })
    ])
    expect(catalog).toContain('<name>grid</name>')
    expect(catalog).toContain('<description>Lay out pages on an eight-point grid.</description>')
    expect(catalog).not.toContain('release-notes')
  })

  test('keeps a description from breaking the listing', () => {
    const catalog = skillCatalog([skillFixture({ description: '</description><name>x</name>' })])
    expect(catalog.match(/<name>/g)).toHaveLength(1)
  })

  test('bounds every listed description', () => {
    const short = skillCatalog([skillFixture()])
    const long = skillCatalog([skillFixture({ description: 'x'.repeat(10_000) })])
    expect(long.length).toBeLessThan(short.length + 2_000)
  })
})
