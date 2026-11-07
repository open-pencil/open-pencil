import { afterAll, describe, expect, setDefaultTimeout, test } from 'bun:test'
import { createHash } from 'node:crypto'
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { CLI_ENTRY } from '#cli-tests/helpers/paths'
import * as v from 'valibot'

import { es } from '@open-pencil/emit'

setDefaultTimeout(60_000)
const FIG_FIXTURE = Bun.resolveSync('./mapping/fixture.ts', import.meta.dir)
const folders: string[] = []
afterAll(() => Promise.all(folders.map((folder) => rm(folder, { recursive: true, force: true }))))

const Info = v.object({
  revision: v.string(),
  components: v.array(
    v.object({
      id: v.string(),
      properties: v.array(v.object({ id: v.string() })),
      variants: v.array(v.object({ id: v.string() }))
    })
  )
})

async function run(cwd: string, args: string[]) {
  const child = Bun.spawn([process.execPath, ...args], { cwd, stdout: 'pipe', stderr: 'pipe' })
  const [stdout, stderr] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text()
  ])
  return { stdout, stderr, exitCode: await child.exited }
}

function cli(cwd: string, args: string[], file = 'design.fig') {
  return run(cwd, [CLI_ENTRY, 'export', file, '-f', 'storybook', ...args])
}

// Native helper tests share this process and can cache Core's platform detection.
// Keep the real FIG writer in the same fresh headless environment as the CLI.
async function editFig(cwd: string, ...args: string[]) {
  const result = await run(cwd, [FIG_FIXTURE, ...args])
  if (result.exitCode !== 0) throw new Error(`FIG fixture failed: ${result.stderr}`)
}

async function fixture() {
  const folder = await mkdtemp(join(tmpdir(), 'open-pencil-mapping-cli-'))
  folders.push(folder)
  await editFig(folder, 'create')
  const componentCode = 'export function Button(props: { size?: "sm" | "lg" }) { return null }\n'
  const storyCode = '// developer-owned story with a custom interaction\n'
  await writeFile(join(folder, 'Button.ts'), componentCode)
  await writeFile(join(folder, 'Button.stories.ts'), storyCode)
  const discovered = await cli(folder, ['--mapping-info'])
  expect(discovered.exitCode).toBe(0)
  const parsed = v.safeParse(v.pipe(v.string(), v.parseJson(), Info), discovered.stdout)
  if (!parsed.success) throw new Error(`Invalid mapping discovery: ${v.summarize(parsed.issues)}`)
  const component = parsed.output.components[0]
  const mapping = {
    key: 'button',
    design: { file: 'design.fig', id: component.id },
    implementation: { import: 'Button.ts', export: 'Button' },
    story: { id: 'components-button--default' },
    props: { [component.properties[0].id]: { prop: 'size', values: { Small: 'sm', Large: 'lg' } } },
    states: [
      { key: 'large', designId: component.variants[1].id, storyId: 'components-button--large' }
    ]
  }
  const config = {
    version: 1,
    storybook: { baseUrl: 'https://storybook.example.test/' },
    components: [mapping]
  }
  await writeFile(join(folder, 'openpencil.components.json'), JSON.stringify(config))
  return { folder, config, mapping, revision: parsed.output.revision, componentCode, storyCode }
}

const MAPPED = ['--mapping', 'openpencil.components.json', '--beside', '--font-policy', 'allow']

describe('mapped Storybook reference CLI', () => {
  test.each([
    { implementation: 'Button.ts', output: '.', expected: './Button.ts' },
    { implementation: '.storybook/Button.ts', output: '.', expected: './.storybook/Button.ts' },
    { implementation: '.Button.ts', output: '.', expected: './.Button.ts' },
    { implementation: '.storybook/Button.ts', output: '.storybook', expected: './Button.ts' },
    { implementation: '.Button.ts', output: 'references', expected: '../.Button.ts' },
    {
      implementation: '.storybook/Button.ts',
      output: 'references',
      expected: '../.storybook/Button.ts'
    }
  ])(
    'resolves $implementation relative to output $output',
    async ({ implementation, output, expected }) => {
      const { folder, config, mapping, componentCode } = await fixture()
      await mkdir(dirname(join(folder, implementation)), { recursive: true })
      await writeFile(join(folder, implementation), componentCode)
      await writeFile(
        join(folder, 'openpencil.components.json'),
        JSON.stringify({
          ...config,
          components: [
            { ...mapping, implementation: { ...mapping.implementation, import: implementation } }
          ]
        })
      )
      const result = await cli(folder, [
        '--mapping',
        'openpencil.components.json',
        '--output',
        output,
        '--no-design-images'
      ])
      expect(result.stderr).toBe('')
      expect(result.exitCode).toBe(0)
      const referencePath = join(folder, output, 'button.design.ts')
      const source = await readFile(referencePath, 'utf8')
      const module = es.parseModule(source)
      const imported = module.body.find((node) => node.type === 'ImportDeclaration')
      const specifier = es.child(imported, 'source')?.value
      expect(specifier).toBe(expected)
      if (typeof specifier !== 'string') throw new Error('Expected an implementation import')
      expect(await realpath(Bun.resolveSync(specifier, dirname(referencePath)))).toBe(
        await realpath(join(folder, implementation))
      )
    }
  )

  test('keeps imports portable through a symlinked output ancestor that does not exist yet', async () => {
    const { folder } = await fixture()
    await symlink(folder, join(folder, 'alias'), 'dir')
    const result = await cli(folder, [
      '--mapping',
      'openpencil.components.json',
      '--output',
      join(folder, 'alias/nested/references'),
      '--no-design-images'
    ])
    expect(result.exitCode).toBe(0)
    const source = await readFile(join(folder, 'nested/references/button.design.ts'), 'utf8')
    const module = es.parseModule(source)
    const imported = module.body.find((node) => node.type === 'ImportDeclaration')
    expect(es.child(imported, 'source')?.value).toBe('../../Button.ts')
  })
  test('keeps ownership distinct when config and document names contain delimiters', async () => {
    const { folder, config, mapping } = await fixture()
    const bytes = await readFile(join(folder, 'design.fig'))
    await writeFile(join(folder, 'c.fig'), bytes)
    await writeFile(join(folder, 'b.json#c.fig'), bytes)
    await writeFile(
      join(folder, 'a.json#b.json'),
      JSON.stringify({
        ...config,
        components: [{ ...mapping, design: { ...mapping.design, file: 'c.fig' } }]
      })
    )
    await writeFile(
      join(folder, 'a.json'),
      JSON.stringify({
        ...config,
        components: [{ ...mapping, design: { ...mapping.design, file: 'b.json#c.fig' } }]
      })
    )
    const first = await cli(
      folder,
      ['--mapping', 'a.json#b.json', '--output', '.', '--no-design-images'],
      'c.fig'
    )
    expect(first.exitCode).toBe(0)
    const before = await readFile(join(folder, 'button.design.ts'), 'utf8')
    const second = await cli(
      folder,
      ['--mapping', 'a.json', '--output', '.', '--no-design-images'],
      'b.json#c.fig'
    )
    expect(second.exitCode).toBe(1)
    expect(second.stderr).toContain('was generated from')
    expect(await readFile(join(folder, 'button.design.ts'), 'utf8')).toBe(before)
  })
  test('discovers original-byte SHA and persists associations through rename, duplicate names and reopen', async () => {
    const { folder, mapping, revision, componentCode, storyCode } = await fixture()
    const bytes = new Uint8Array(await readFile(join(folder, 'design.fig')))
    expect(revision).toBe(createHash('sha256').update(bytes).digest('hex'))
    const exported = await cli(folder, MAPPED)
    expect(exported.stderr).toBe('')
    expect(exported.exitCode).toBe(0)
    const reference = await readFile(join(folder, 'button.design.ts'), 'utf8')
    const firstImage = await readFile(join(folder, 'button.design/default.png'))
    expect(firstImage.subarray(1, 4).toString()).toBe('PNG')
    const repeated = await cli(folder, MAPPED)
    expect(repeated.exitCode).toBe(0)
    expect(await readFile(join(folder, 'button.design.ts'), 'utf8')).toBe(reference)
    expect(await readFile(join(folder, 'button.design/default.png'))).toEqual(firstImage)
    await editFig(folder, 'rename', mapping.design.id)
    const renamed = await cli(folder, MAPPED)
    expect(renamed.stderr).toBe('')
    expect(renamed.exitCode).toBe(0)
    const module: {
      default: {
        design: { id: string }
        args: { size: string }
        states: { large: { args: { size: string } } }
      }
    } = await import(join(folder, 'button.design.ts'))
    expect(module.default.design.id).toBe(mapping.design.id)
    expect(module.default.args.size).toBe('sm')
    expect(module.default.states.large.args.size).toBe('lg')
    expect(await readFile(join(folder, 'Button.ts'), 'utf8')).toBe(componentCode)
    expect(await readFile(join(folder, 'Button.stories.ts'), 'utf8')).toBe(storyCode)
  })

  test('rejects stale revisions, missing identities, moved paths and duplicate mappings before publication', async () => {
    const { folder, config, mapping } = await fixture()
    const cases = [
      {
        ...config,
        components: [{ ...mapping, design: { ...mapping.design, revision: 'b'.repeat(64) } }]
      },
      { ...config, components: [{ ...mapping, design: { ...mapping.design, id: '1:99999' } }] },
      { ...config, components: [{ ...mapping, design: { ...mapping.design, file: 'moved.fig' } }] },
      { ...config, components: [mapping, mapping] }
    ]
    for (const candidate of cases) {
      await writeFile(join(folder, 'openpencil.components.json'), JSON.stringify(candidate))
      const result = await cli(folder, [...MAPPED, '--no-design-images'])
      expect(result.exitCode).toBe(1)
      expect(result.stderr.length).toBeGreaterThan(0)
      expect((await readdir(folder)).some((name) => name.startsWith('button.design'))).toBe(false)
    }
  })

  test('refuses a handwritten reference collision and preserves ordinary developer stories', async () => {
    const { folder, storyCode } = await fixture()
    await writeFile(join(folder, 'button.design.ts'), 'export const handwritten = true\n')
    const result = await cli(folder, [...MAPPED, '--no-design-images'])
    expect(result.exitCode).toBe(1)
    expect(result.stderr).toContain('was not generated by this export')
    expect(await readFile(join(folder, 'button.design.ts'), 'utf8')).toBe(
      'export const handwritten = true\n'
    )
    expect(await readFile(join(folder, 'Button.stories.ts'), 'utf8')).toBe(storyCode)
    expect((await readdir(folder)).includes('.openpencil-stories.json')).toBe(false)
  })

  test('reference-only mode leaves an earlier ordinary generated export intact', async () => {
    const { folder } = await fixture()
    await mkdir(join(folder, 'normal'))
    const ordinary = await cli(folder, [
      '--output',
      'normal',
      '--framework',
      'html',
      '--fonts',
      'none',
      '--no-design-images'
    ])
    expect(ordinary.exitCode).toBe(0)
    const before = await readFile(join(folder, 'normal/Button.stories.ts'), 'utf8')
    const mapped = await cli(folder, [
      '--mapping',
      'openpencil.components.json',
      '--output',
      'normal',
      '--no-design-images'
    ])
    expect(mapped.exitCode).toBe(0)
    expect(await readFile(join(folder, 'normal/Button.stories.ts'), 'utf8')).toBe(before)
    expect((await readdir(join(folder, 'normal'))).includes('button.design.ts')).toBe(true)
  })
})
