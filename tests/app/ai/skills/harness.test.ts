import { expect, test } from 'bun:test'

import { harnessSkills } from '@/app/ai/skills/harness'
import type { Skill } from '@/app/ai/skills/types'

import { skillFixture } from '#tests/helpers/chat/skills'

function library(skills: Skill[]) {
  return { refresh: async () => undefined, enabled: () => skills }
}

test('Pi gets the skills the model may load, with their files', async () => {
  const files: Record<string, string> = { 'references/spacing.md': '8', 'gone.md': '' }
  const grid = skillFixture({
    files: Object.keys(files),
    readFile: (path) =>
      path === 'gone.md' ? Promise.reject(new Error('Gone')) : Promise.resolve(files[path] ?? '')
  })
  const manual = skillFixture({ name: 'manual', modelInvocable: false })
  expect(await harnessSkills(library([grid, manual]))).toEqual([
    {
      name: 'grid',
      description: grid.description,
      content: grid.instructions,
      files: [{ path: 'references/spacing.md', content: '8' }]
    }
  ])
})

test('files past the size budget are left out, the instructions stay', async () => {
  const large = 'x'.repeat(300 * 1024)
  const skills = ['first', 'second'].map((name) =>
    skillFixture({ name, files: ['big.md'], readFile: () => Promise.resolve(large) })
  )
  const result = await harnessSkills(library(skills))
  expect(result.map((skill) => [skill.name, skill.files?.length])).toEqual([
    ['first', 1],
    ['second', 0]
  ])
})

test('the budget counts UTF-8 bytes, which non-Latin text takes more of', async () => {
  // 200 000 characters, 400 000 bytes: past the budget though shorter than it in characters.
  const wide = skillFixture({
    files: ['notes.md'],
    readFile: () => Promise.resolve('é'.repeat(200_000))
  })
  const [skill] = await harnessSkills(library([wide]))
  expect(skill?.files).toEqual([])
})

test('the budget counts the JSON escapes control characters take', async () => {
  // 100 000 NUL bytes become 600 000 bytes of `\u0000` escapes.
  const nul = skillFixture({
    files: ['blob.txt'],
    readFile: () => Promise.resolve('\u0000'.repeat(100_000))
  })
  const [skill] = await harnessSkills(library([nul]))
  expect(skill?.files).toEqual([])
})
