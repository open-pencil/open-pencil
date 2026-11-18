import { describe, expect, test } from 'bun:test'

import { lint, lintFiles, ruleDiagnostics } from '#oxlint-plugin-tests/helpers/lint'

const rule = '@open-pencil/imports/no-deep-parent-relative-imports'

async function diagnostics(source: string, options?: Record<string, unknown>) {
  const config = options ? ['error', options] : 'error'
  return ruleDiagnostics(await lint(source, { [rule]: config }), rule)
}

describe(rule, () => {
  test.each([
    "import { point } from '../../geometry/point'",
    "export { point } from '../../geometry/point'",
    "export * from '../../../geometry'",
    "const point = await import('../../geometry/point')"
  ])('rejects %s', async (source) => {
    expect(await diagnostics(source)).toHaveLength(1)
  })

  test.each([
    "import { point } from '../geometry/point'",
    "import { point } from './point'",
    "import { point } from '#app/geometry/point'",
    "import manifest from '../../package.json'"
  ])('accepts %s', async (source) => {
    expect(await diagnostics(source)).toHaveLength(0)
  })

  test('minDepth: 1 rejects any parent import and names the alias', async () => {
    const found = await diagnostics("import { point } from '../geometry/point'", {
      minDepth: 1,
      alias: '#core/*'
    })
    expect(found.map((diagnostic) => diagnostic.message)).toEqual([
      'Use the #core/* alias instead of parent-relative imports.'
    ])
  })
})

describe('@open-pencil/imports/no-function-aliases', () => {
  const aliasRule = '@open-pencil/imports/no-function-aliases'
  const count = async (source: string) =>
    ruleDiagnostics(await lint(source, { [aliasRule]: 'error' }), aliasRule).length

  test('rejects an import renamed to end in Fn', async () => {
    expect(await count("import { parse as parseFn } from './parse'")).toBe(1)
  })

  test('accepts other renames and plain imports', async () => {
    expect(await count("import { parse as parsePoint } from './parse'")).toBe(0)
    expect(await count("import { parseFn } from './parse'")).toBe(0)
  })
})

// A template that climbs one level and then names a folder, assembled so it stays source text.
const oneLevelTemplate = ['join(import.meta.dir, `../', '$', "{folder}`, '..', 'assets')"].join('')

describe('@open-pencil/imports/no-deep-parent-relative-paths', () => {
  const rule = '@open-pencil/imports/no-deep-parent-relative-paths'
  const rules = { [rule]: 'error' }

  test.each([
    "new URL('../../fixtures/a.fig', import.meta.url)",
    'new URL(`../../fixtures/a.fig`, import.meta.url)',
    "resolve(import.meta.dir, '../../../tests/fixtures')",
    "join(import.meta.dirname, '..', '..', 'assets')",
    "path.resolve(import.meta.dir, '../..')",
    "join(import.meta.dir, '..\\\\..\\\\assets')",
    "join(dirname(fileURLToPath(import.meta.url)), '../../fixtures')"
  ])('rejects %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(1)
  })

  test.each([
    "new URL('../fixtures/a.fig', import.meta.url)",
    "new URL('./worker.ts', import.meta.url)",
    "join(import.meta.dir, '..', 'fixtures')",
    "credentialRef('../../other-app', 'api-key')",
    "resolve(root, '../../somewhere')",
    "join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures')",
    oneLevelTemplate
  ])('accepts %s', async (source) => {
    expect(ruleDiagnostics(await lint(source, rules), rule)).toHaveLength(0)
  })
})

test('no-cwd-relative-paths flags file and script paths taken from the working directory', async () => {
  const rule = '@open-pencil/imports/no-cwd-relative-paths'
  const cases = {
    'bun-spawn.ts': ["Bun.spawn([process.execPath, 'tests/helpers/fixture.ts'])", 1],
    'bun-cmd.ts': [
      "Bun.spawnSync({ cmd: [process.execPath, 'packages/core/tests/matrix.ts'] })",
      1
    ],
    'node-args.ts': ["spawn('bun', ['./scripts/run.mjs'])", 1],
    'node-command.ts': ["execFileSync('scripts/build.ts')", 1],
    'bun-run.ts': ["Bun.spawn(['bun', 'run', '--silent', 'tools/dev/serve.ts'])", 1],
    'flag-value.ts': ["Bun.spawn(['bun', '--cwd', 'dir', 'scripts/x.ts'])", 1],
    'node-import.ts': ["spawn('node', ['--import', 'tsx/esm', 'scripts/x.ts'])", 1],
    'bun-file.ts': ["Bun.file('packages/core/assets/Inter.ttf')", 1],
    'read-file.ts': ["readFileSync('tests/fixtures/a.fig')", 1],
    'fs-read.ts': ["fs.readFile('tests/fixtures/a.json', 'utf8')", 1],
    'resolved.ts': ["Bun.spawn([process.execPath, join(import.meta.dir, 'matrix.ts')])", 0],
    'with-cwd.ts': ["Bun.spawn([process.execPath, 'tests/x.ts'], { cwd: root })", 0],
    'absolute.ts': ["Bun.spawn([process.execPath, '/tmp/script.ts'])", 0],
    'git-pathspec.ts': ["Bun.spawn(['git', 'log', '--', 'src/app/index.ts'])", 0],
    'script-name.ts': ["Bun.spawn([process.execPath, 'run', 'build'])", 0],
    'resolved-file.ts': ["readFileSync(repoPath('tests/fixtures/a.fig'))", 0],
    'bare-name.ts': ["readFileSync('package.json')", 0],
    'method.ts': ["skill.readFile('references/spacing.md')", 0],
    'url.ts': ["Bun.file('file:///tmp/a.txt')", 0],
    'not-a-path-call.ts': ["resolve('tests/helpers/fixture.ts')", 0]
  } as const
  const diagnostics = ruleDiagnostics(
    await lintFiles(
      Object.fromEntries(Object.entries(cases).map(([path, [source]]) => [path, source])),
      { [rule]: 'error' }
    ),
    rule
  )
  for (const [path, [, count]] of Object.entries(cases)) {
    const found = diagnostics.filter((diagnostic) => diagnostic.filename?.endsWith(path))
    expect(found, path).toHaveLength(count)
  }
})
