import { expect, test } from 'bun:test'

import { readProjectSkills, type ProjectSkillReader } from '@/app/ai/skills/sources/project'

const SKILL = '---\nname: grid\ndescription: Lay out pages on a grid.\n---\nSnap to 8.'

test('reads the skills folders a document sees, nearest first, marked with their folder', async () => {
  const roots: Record<string, unknown> = {
    '/home/me/site/design/.agents/skills': [
      {
        name: 'grid',
        path: '/home/me/site/design/.agents/skills/grid',
        skillFile: SKILL,
        files: []
      }
    ],
    '/home/me/site/.claude/skills': [
      { name: 'broken', path: '/home/me/site/.claude/skills/broken', skillFile: '# x', files: [] }
    ]
  }
  const reader: ProjectSkillReader = {
    skillsFolders: async (dir) => (dir === '/home/me/site/design' ? Object.keys(roots) : []),
    folders: async (root) => roots[root] ?? [],
    readFile: async () => ''
  }
  const scan = await readProjectSkills('/home/me/site/design', '/home/me', reader)
  expect(scan.folders).toEqual([
    { path: '/home/me/site/design/.agents/skills', location: '~/site/design/.agents/skills' },
    { path: '/home/me/site/.claude/skills', location: '~/site/.claude/skills' }
  ])
  expect(scan.skills).toMatchObject([
    {
      name: 'grid',
      source: 'project',
      location: '~/site/design/.agents/skills/grid',
      skillsFolder: '/home/me/site/design/.agents/skills'
    }
  ])
  expect(scan.problems).toMatchObject([
    { source: 'project', skillsFolder: '/home/me/site/.claude/skills', folder: 'broken' }
  ])
})

test('a document folder that cannot be searched has no skills', async () => {
  const reader: ProjectSkillReader = {
    skillsFolders: () => Promise.reject(new Error('No access')),
    folders: async () => [],
    readFile: async () => ''
  }
  expect(await readProjectSkills('/tmp', '/home/me', reader)).toEqual({
    folders: [],
    skills: [],
    problems: []
  })
})
