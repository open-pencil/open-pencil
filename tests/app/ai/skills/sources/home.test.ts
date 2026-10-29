import { describe, expect, test } from 'bun:test'

import { readHomeSkills, type HomeSkillReader } from '@/app/ai/skills/sources/home'

const SKILL = '---\nname: grid\ndescription: Lay out pages on a grid.\n---\nSnap to 8.'

function reader(roots: Record<string, unknown>): HomeSkillReader & { reads: string[] } {
  const reads: string[] = []
  return {
    reads,
    folders: async (root) => {
      if (!(root in roots)) throw new Error('No such folder')
      return roots[root]
    },
    readFile: async (dir, path) => {
      reads.push(`${dir}/${path}`)
      return 'reference'
    }
  }
}

describe('readHomeSkills', () => {
  test('reads skills from the shared folder before Claude Code’s', async () => {
    const files = reader({
      '/home/.agents/skills': [
        { name: 'grid', path: '/home/.agents/skills/grid', skillFile: SKILL, files: ['ref.md'] }
      ],
      '/home/.claude/skills': [
        { name: 'grid', path: '/home/.claude/skills/grid', skillFile: SKILL, files: [] }
      ]
    })
    const scan = await readHomeSkills('/home', files)
    expect(scan.skills.map((skill) => [skill.source, skill.location])).toEqual([
      ['agents', '~/.agents/skills/grid'],
      ['claude', '~/.claude/skills/grid']
    ])
    await scan.skills[0]?.readFile('ref.md')
    expect(files.reads).toEqual(['/home/.agents/skills/grid/ref.md'])
  })

  test('reports a folder that is not a valid skill and keeps the rest', async () => {
    const scan = await readHomeSkills(
      '/home',
      reader({
        '/home/.agents/skills': [
          { name: 'broken', path: '/x/broken', skillFile: 'no frontmatter', files: [] },
          { name: 'grid', path: '/x/grid', skillFile: SKILL, files: [] }
        ]
      })
    )
    expect(scan.skills.map((skill) => skill.name)).toEqual(['grid'])
    expect(scan.problems.map((problem) => problem.folder)).toEqual(['broken'])
  })

  test('finds nothing in a missing or unreadable folder', async () => {
    const scan = await readHomeSkills('/home', reader({ '/home/.claude/skills': 'not a list' }))
    expect(scan).toEqual({ skills: [], problems: [] })
  })
})
