import { describe, expect, test } from 'bun:test'

import {
  enabledSkillsFrom,
  withPickedSkills,
  type SkillPreferences
} from '@/app/ai/skills/preferences'

import { skillFixture } from '#tests/helpers/chat/skills'

const none: SkillPreferences = { sources: {}, skills: {}, trustedFolders: {}, pickedSources: {} }
/** Coding agents' folders switched on, as after picking one of their skills. */
const homeOn: SkillPreferences = { ...none, sources: { agents: true, claude: true } }

describe('enabledSkillsFrom', () => {
  test('offers uploads at once, and coding agents’ skills only once their folder is on', () => {
    const upload = skillFixture({ name: 'brand', source: 'openpencil' })
    const skills = [upload, skillFixture(), skillFixture({ name: 'type-scale', source: 'claude' })]
    expect(enabledSkillsFrom(skills, none)).toEqual([upload])
    expect(enabledSkillsFrom(skills, homeOn)).toEqual(skills)
  })

  test('leaves out a source or a skill the user turned off', () => {
    const grid = skillFixture()
    const scale = skillFixture({ name: 'type-scale', source: 'claude' })
    expect(
      enabledSkillsFrom([grid, scale], { ...homeOn, sources: { agents: true, claude: false } })
    ).toEqual([grid])
    expect(
      enabledSkillsFrom([grid, scale], { ...homeOn, skills: { 'agents/grid': false } })
    ).toEqual([scale])
  })

  test('offers the first skill of a name, and the next once the first is off', () => {
    const shared = skillFixture()
    const claude = skillFixture({ source: 'claude' })
    expect(enabledSkillsFrom([shared, claude], homeOn)).toEqual([shared])
    expect(
      enabledSkillsFrom([shared, claude], { ...homeOn, skills: { 'agents/grid': false } })
    ).toEqual([claude])
  })

  test('offers a skill from a folder near the document only once the folder is trusted', () => {
    const folder = '/work/site/.agents/skills'
    const project = skillFixture({ source: 'project', skillsFolder: folder })
    const shared = skillFixture({ name: 'type-scale', source: 'openpencil' })
    expect(enabledSkillsFrom([project, shared], none)).toEqual([shared])
    const trusted = { ...none, trustedFolders: { [folder]: true } }
    expect(enabledSkillsFrom([project, shared], trusted)).toEqual([project, shared])
    expect(
      enabledSkillsFrom([project], { ...trusted, skills: { [`project/${folder}/grid`]: false } })
    ).toEqual([])
  })

  test('picking skills turns on their folders and only them', () => {
    const grid = skillFixture()
    const release = skillFixture({ name: 'release' })
    const review = skillFixture({ name: 'pr-review', source: 'claude' })
    const picked = withPickedSkills(none, [grid, release, review], new Set(['agents/grid']))
    expect(enabledSkillsFrom([grid, release, review], picked)).toEqual([grid])
    expect(picked.sources).toEqual({ agents: true })
    // A skill installed in that folder later was never picked, so it stays off.
    const later = skillFixture({ name: 'later' })
    expect(enabledSkillsFrom([grid, later], picked)).toEqual([grid])
  })
})
