import { describe, expect, test } from 'bun:test'

import { appendSkillContext, stripModelNotes } from '@/app/ai/chat/context'
import { invokedSkill } from '@/app/ai/skills/invoke'
import type { SkillLibrary } from '@/app/ai/skills/library'
import type { Skill } from '@/app/ai/skills/types'

import { skillFixture } from '#tests/helpers/chat/skills'

function library(skills: Skill[]): SkillLibrary & { reads: number } {
  const result = {
    reads: 0,
    refresh: async () => {
      result.reads++
    },
    enabled: () => skills
  }
  return result
}

describe('running a skill by name', () => {
  test('finds the skill a message starts with, read fresh', async () => {
    const skills = library([skillFixture()])
    expect(await invokedSkill('/skill:grid lay out the hero', skills)).toMatchObject({
      name: 'grid'
    })
    expect(skills.reads).toBe(1)
  })

  test('ignores text without a command, unknown names, and skills not run by name', async () => {
    const skills = library([skillFixture(), skillFixture({ name: 'brand', userInvocable: false })])
    expect(await invokedSkill('lay out /skill:grid', skills)).toBeNull()
    expect(await invokedSkill('/skill:missing', skills)).toBeNull()
    expect(await invokedSkill('/skill:brand', skills)).toBeNull()
    expect(skills.reads).toBe(2)
  })

  test('gives the model the instructions in a note the transcript leaves out', () => {
    const text = appendSkillContext('/skill:grid lay out the hero', {
      name: 'grid',
      instructions: 'Snap every frame to multiples of 8.'
    })
    expect(text).toContain('<skill name="grid">\nSnap every frame to multiples of 8.\n</skill>')
    expect(stripModelNotes(text)).toBe('/skill:grid lay out the hero')
    expect(appendSkillContext('hello', null)).toBe('hello')
  })
})
