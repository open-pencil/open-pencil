import { describe, expect, test } from 'bun:test'

import dedent from 'dedent'

import { parseSkill } from '@/app/ai/skills/parse'

describe('parseSkill', () => {
  test('reads the frontmatter and the instructions below it', () => {
    const result = parseSkill(
      dedent`
        ---
        name: brand-review
        description: Check a layout against the brand guide.
        disable-model-invocation: true
        ---

        # Brand review

        Use the brand colors only.
      `,
      'brand-review'
    )
    expect(result).toEqual({
      ok: true,
      skill: {
        name: 'brand-review',
        description: 'Check a layout against the brand guide.',
        instructions: '# Brand review\n\nUse the brand colors only.',
        modelInvocable: false,
        userInvocable: true
      },
      warnings: []
    })
  })

  test('keeps fields it does not use out of the way', () => {
    const result = parseSkill(
      '---\nname: grid\ndescription: Grids.\nlicense: MIT\nmetadata:\n  author: someone\n---\nBody',
      'grid'
    )
    expect(result.ok && result.warnings).toEqual([])
  })

  test('fails a skill that cannot be offered', () => {
    expect(parseSkill('# No frontmatter', 'grid')).toEqual({
      ok: false,
      error: { code: 'no-frontmatter' }
    })
    expect(parseSkill('---\nname: grid\n---\nBody', 'grid')).toEqual({
      ok: false,
      error: { code: 'no-description' }
    })
    const invalid = parseSkill('---\nname: grid\ndescription: 42\n---\n', 'grid')
    expect(!invalid.ok && invalid.error.code).toBe('invalid-frontmatter')
    expect(parseSkill('---\ndescription: Grids.\n---\n', null)).toEqual({
      ok: false,
      error: { code: 'no-name' }
    })
  })

  test('reads frontmatter that is not valid YAML line by line, with a warning', () => {
    const result = parseSkill(
      '---\nname: grid\ndescription: Grids: columns, gutters,\n  and margins.\ndisable-model-invocation: true\n---\nBody',
      'grid'
    )
    expect(result.ok && result.skill.description).toBe('Grids: columns, gutters, and margins.')
    expect(result.ok && result.skill.modelInvocable).toBe(false)
    expect(result.ok && result.warnings).toEqual(['plain-frontmatter'])
  })

  test('loads a skill that departs from the specification, with warnings', () => {
    const unnamed = parseSkill('---\ndescription: Grids.\n---\nBody', 'grid')
    expect(unnamed.ok && unnamed.skill.name).toBe('grid')
    expect(unnamed.ok && unnamed.warnings).toEqual(['name-from-folder'])

    const misnamed = parseSkill('---\nname: Grid Rules\ndescription: Grids.\n---\nBody', 'grid')
    expect(misnamed.ok && misnamed.skill.name).toBe('Grid Rules')
    expect(misnamed.ok && misnamed.warnings).toEqual(['name-format', 'name-mismatch'])
  })
})
