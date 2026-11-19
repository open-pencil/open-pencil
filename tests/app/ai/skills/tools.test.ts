import { describe, expect, test } from 'bun:test'

import { createSkillTools } from '@/app/ai/skills/tools'
import type { Skill } from '@/app/ai/skills/types'

import { skillFixture } from '#tests/helpers/chat/skills'

const callOptions = { toolCallId: 'call', messages: [], context: {} }

function toolsFor(skills: Skill[]) {
  const tools = createSkillTools(() => skills)
  return {
    load: (input: { name: string }) => tools.load_skill.execute?.(input, callOptions),
    read: (input: { name: string; path: string }) =>
      tools.read_skill_file.execute?.(input, callOptions)
  }
}

describe('load_skill', () => {
  test('returns the instructions and the files the skill can offer', async () => {
    const tools = toolsFor([skillFixture({ files: ['references/spacing.md'] })])
    expect(await tools.load({ name: 'grid' })).toEqual({
      name: 'grid',
      instructions: 'Snap every frame to multiples of 8.',
      files: ['references/spacing.md']
    })
  })

  test('fails for a skill that is not enabled', async () => {
    expect(await toolsFor([skillFixture()]).load({ name: 'missing' })).toHaveProperty('error')
  })
})

describe('read_skill_file', () => {
  test('reads a file the skill lists', async () => {
    const skill = skillFixture({
      files: ['references/spacing.md'],
      readFile: (path) => Promise.resolve(`contents of ${path}`)
    })
    expect(await toolsFor([skill]).read({ name: 'grid', path: 'references/spacing.md' })).toEqual({
      path: 'references/spacing.md',
      text: 'contents of references/spacing.md'
    })
  })

  test('never reads a path the skill does not list', async () => {
    const requested: string[] = []
    const skill = skillFixture({
      files: ['references/spacing.md'],
      readFile: (path) => {
        requested.push(path)
        return Promise.resolve('')
      }
    })
    const result = await toolsFor([skill]).read({ name: 'grid', path: '../../.ssh/id_rsa' })
    expect(result).toHaveProperty('error')
    expect(requested).toEqual([])
  })

  test('shortens a long file and says so', async () => {
    const skill = skillFixture({
      files: ['big.md'],
      readFile: () => Promise.resolve('x'.repeat(1_000_000))
    })
    const result = await toolsFor([skill]).read({ name: 'grid', path: 'big.md' })
    expect(result).toMatchObject({ truncated: true })
  })

  test('reports a file that cannot be read', async () => {
    const skill = skillFixture({ files: ['gone.md'] })
    expect(await toolsFor([skill]).read({ name: 'grid', path: 'gone.md' })).toHaveProperty('error')
  })
})
