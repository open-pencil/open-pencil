import { describe, expect, test } from 'bun:test'

import { strToU8, zipSync } from 'fflate'

import {
  skillFromArchive,
  skillFromUpload,
  skillsFromUploads
} from '@/app/ai/skills/sources/uploaded'

const SKILL = '---\nname: grid\ndescription: Lay out pages on a grid.\n---\nSnap to 8.'

function archive(files: Record<string, string | Uint8Array>): Uint8Array {
  return zipSync(
    Object.fromEntries(
      Object.entries(files).map(([path, content]) => [
        path,
        typeof content === 'string' ? strToU8(content) : content
      ])
    )
  )
}

describe('skillFromArchive', () => {
  test('reads a skill folder packed with its files', () => {
    const upload = skillFromArchive(
      archive({
        'grid/SKILL.md': SKILL,
        'grid/references/spacing.md': '8, 16, 24',
        'grid/assets/logo.png': new Uint8Array([0x89, 0x50, 0xff, 0xfe]),
        '__MACOSX/grid/._SKILL.md': 'resource fork',
        'grid/.DS_Store': 'finder'
      }),
      1
    )
    expect(upload).toEqual({
      ok: true,
      skill: {
        name: 'grid',
        skillFile: SKILL,
        files: [{ path: 'references/spacing.md', content: '8, 16, 24' }],
        uploadedAt: 1
      }
    })
  })

  test('reads a skill packed at the archive root', () => {
    const upload = skillFromArchive(archive({ 'SKILL.md': SKILL, 'notes.md': 'n' }), 1)
    expect(upload.ok && upload.skill.files.map((file) => file.path)).toEqual(['notes.md'])
  })

  test('refuses an archive without exactly one skill', () => {
    expect(skillFromArchive(archive({ 'README.md': 'no skill' }), 1)).toMatchObject({
      reason: 'no-skill'
    })
    expect(
      skillFromArchive(archive({ 'a/SKILL.md': SKILL, 'b/SKILL.md': SKILL }), 1)
    ).toMatchObject({ reason: 'several-skills' })
    expect(skillFromArchive(strToU8('not a zip'), 1)).toMatchObject({ reason: 'unreadable' })
    expect(skillFromArchive(archive({ 'grid/SKILL.md': '# no frontmatter' }), 1)).toMatchObject({
      reason: 'invalid'
    })
  })
})

test('refuses an archive that would unpack past its limits before inflating it', () => {
  // Zeros deflate to almost nothing; together these declare far more than an upload may hold.
  const zeros = new Uint8Array(1024 * 1024)
  const files = Object.fromEntries(
    Array.from({ length: 30 }, (_, index) => [`grid/zeros-${index}.txt`, zeros])
  )
  expect(skillFromArchive(archive({ 'grid/SKILL.md': SKILL, ...files }), 0)).toEqual({
    ok: false,
    reason: 'too-large'
  })
  const many = Object.fromEntries(
    Array.from({ length: 250 }, (_, index) => [`grid/notes-${index}.md`, 'x'])
  )
  expect(skillFromArchive(archive({ 'grid/SKILL.md': SKILL, ...many }), 0)).toEqual({
    ok: false,
    reason: 'too-large'
  })
})

describe('skillFromUpload', () => {
  test('reads a SKILL.md on its own, which must name itself', async () => {
    const upload = await skillFromUpload(new File([SKILL], 'SKILL.md'), 1)
    expect(upload.ok && upload.skill.name).toBe('grid')
    const unnamed = new File(['---\ndescription: Grids.\n---\n'], 'SKILL.md')
    expect(await skillFromUpload(unnamed, 1)).toMatchObject({ reason: 'invalid' })
  })
})

describe('skillsFromUploads', () => {
  test('offers an upload’s files to the chat', async () => {
    const { skills } = skillsFromUploads([
      {
        name: 'grid',
        skillFile: SKILL,
        files: [{ path: 'references/spacing.md', content: '8' }],
        uploadedAt: 1
      }
    ])
    expect(skills.map((skill) => [skill.source, skill.name, skill.files])).toEqual([
      ['openpencil', 'grid', ['references/spacing.md']]
    ])
    expect(await skills[0]?.readFile('references/spacing.md')).toBe('8')
  })
})

test('an upload named by its folder still loads when read back', () => {
  const upload = skillFromArchive(
    archive({ 'grid/SKILL.md': '---\ndescription: Lay out pages on a grid.\n---\nSnap to 8.' }),
    0
  )
  if (!upload.ok) throw new Error('Expected the upload to be accepted')
  const { skills, problems } = skillsFromUploads([upload.skill])
  expect(problems).toEqual([])
  expect(skills).toMatchObject([{ name: 'grid', warnings: ['name-from-folder'] }])
})
