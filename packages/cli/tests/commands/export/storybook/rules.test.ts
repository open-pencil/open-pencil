import { describe, expect, test } from 'bun:test'
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { readStoryRules, storyPlan } from '#cli/commands/export/storybook/rules'

const target = (page: string, name: string) => ({
  document: 'Kit',
  page,
  name,
  title: `Kit/${page}/${name}`
})

describe('Storybook export rules', () => {
  test('apply every matching rule in order, each field on its own', () => {
    const plan = storyPlan({
      rules: [
        { match: '**', title: 'Design system/{page}/{name}' },
        { match: 'Icons/**', stories: 'gallery' },
        { match: 'Icons/legacy', stories: 'none' }
      ]
    })
    expect(plan(target('Icons', 'icon'))).toEqual({
      stories: 'gallery',
      title: 'Design system/Icons/icon'
    })
    expect(plan(target('Icons', 'legacy')).stories).toBe('none')
    // A file no rule names keeps everything it would have.
    expect(storyPlan({ rules: [{ match: 'Icons/**', stories: 'single' }] })(target('Forms', 'input'))).toEqual({})
  })

  test('fill titles from the file, its default title included', () => {
    const plan = storyPlan({ rules: [{ match: '**', title: '{path} ({document})' }] })
    expect(plan(target('Forms', 'input')).title).toBe('Kit/Forms/input (Kit)')
  })

  test('match the original names, so a renamed title never changes which rules apply', () => {
    const plan = storyPlan({
      rules: [
        { match: 'Forms/**', title: 'Inputs/{name}' },
        { match: 'Inputs/**', stories: 'none' }
      ]
    })
    expect(plan(target('Forms', 'input'))).toEqual({ title: 'Inputs/input' })
  })

  test('read a rules file, and reject one that is not valid JSON or not rules', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'open-pencil-rules-'))
    const good = join(dir, 'good.json')
    await writeFile(good, JSON.stringify({ rules: [{ match: '**', stories: 'single' }] }))
    expect(await readStoryRules(good)).toEqual({ rules: [{ match: '**', stories: 'single' }] })

    const bad = join(dir, 'bad.json')
    await writeFile(bad, JSON.stringify({ rules: [{ match: '**', stories: 'some' }] }))
    await expect(readStoryRules(bad)).rejects.toThrow(/Invalid rules/)
    await writeFile(bad, '{ not json')
    await expect(readStoryRules(bad)).rejects.toThrow(/Invalid rules/)
  })
})
