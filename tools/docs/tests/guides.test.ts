import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkGuideMap, listedGuides } from '../src/guides'

async function repo(rootGuide: string, guides: string[] = []) {
  const repoRoot = await mkdtemp(join(tmpdir(), 'open-pencil-guides-'))
  await writeFile(join(repoRoot, 'AGENTS.md'), rootGuide, 'utf8')
  for (const guide of guides) {
    await mkdir(join(repoRoot, guide, '..'), { recursive: true })
    await writeFile(join(repoRoot, guide), '# Guide\n', 'utf8')
  }
  return repoRoot
}

describe('listedGuides', () => {
  test('collects unique nested guide paths written as inline code', () => {
    const markdown = [
      '| `packages/core` | Core | `packages/core/AGENTS.md`, `packages/vue/AGENTS.md` |',
      'See `packages/core/AGENTS.md` again and `AGENTS.md` at the root.',
      'Not a guide: `packages/core/README.md` or packages/vue/AGENTS.md without code spans.'
    ].join('\n')

    expect(listedGuides(markdown)).toEqual(['packages/core/AGENTS.md', 'packages/vue/AGENTS.md'])
  })
})

describe('checkGuideMap', () => {
  test('passes when every nested guide is listed and every listed guide exists', async () => {
    const repoRoot = await repo(
      '| `src` | App | `src/AGENTS.md` |\n| `tests` | Tests | `tests/AGENTS.md` |\n',
      [
        'src/AGENTS.md',
        'tests/AGENTS.md',
        'node_modules/dep/AGENTS.md',
        '.claude/worktrees/other/packages/core/AGENTS.md'
      ]
    )

    const result = checkGuideMap({ repoRoot })

    expect(result.errors).toEqual([])
    expect(result.guides).toEqual(['src/AGENTS.md', 'tests/AGENTS.md'])
    expect(result.listed).toEqual(['src/AGENTS.md', 'tests/AGENTS.md'])
  })

  test('reports unlisted guides on disk and listed guides that do not exist', async () => {
    const repoRoot = await repo('Guides: `packages/vue/AGENTS.md`.\n', ['packages/core/AGENTS.md'])

    const result = checkGuideMap({ repoRoot })

    expect(result.errors).toEqual([
      'packages/core/AGENTS.md is not listed in the root AGENTS.md map',
      'Root AGENTS.md references missing guide packages/vue/AGENTS.md'
    ])
  })

  test('fails without a root guide', async () => {
    const repoRoot = await mkdtemp(join(tmpdir(), 'open-pencil-guides-empty-'))

    expect(checkGuideMap({ repoRoot }).errors).toEqual(['Missing root AGENTS.md'])
  })
})
