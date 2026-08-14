import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { checkDocsIntegrity } from '../src/integrity'

async function fixture() {
  const docsRoot = await mkdtemp(join(tmpdir(), 'open-pencil-docs-integrity-'))
  await mkdir(join(docsRoot, 'public'), { recursive: true })
  return docsRoot
}

async function write(path: string, content = '# Page') {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content, 'utf8')
}

function check(docsRoot: string, sidebarLinks: string[] = []) {
  return checkDocsIntegrity({
    docsRoot,
    localePrefixes: ['ru'],
    redirectsPath: join(docsRoot, 'public/_redirects'),
    sidebarLinks
  })
}

describe('checkDocsIntegrity', () => {
  test('accepts valid Markdown, sidebars, redirects, and incomplete locales', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '[Page](/page)')
    await write(join(docsRoot, 'page.md'))
    await write(join(docsRoot, 'ru/index.md'))
    await write(join(docsRoot, 'legacy.md'))
    await writeFile(join(docsRoot, 'public/_redirects'), '/old /page 301\n', 'utf8')

    const result = check(docsRoot, ['/page'])

    expect(result.errors).toEqual([])
    expect(result.localeMissingPages.ru).toEqual(['legacy.md', 'page.md'])
  })

  test('rejects pages copied identically into every locale', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '# English')
    await write(join(docsRoot, 'ru/index.md'), '# Русский')
    await write(join(docsRoot, 'fr/index.md'), '# Français')
    await write(join(docsRoot, 'page.md'), '# Canonical page')
    await write(join(docsRoot, 'ru/page.md'), '# English placeholder')
    await write(join(docsRoot, 'fr/page.md'), '# English placeholder')
    await writeFile(join(docsRoot, 'public/_redirects'), '', 'utf8')

    const result = checkDocsIntegrity({
      docsRoot,
      localePrefixes: ['ru', 'fr'],
      redirectsPath: join(docsRoot, 'public/_redirects'),
      sidebarLinks: []
    })

    expect(result.localePlaceholderPages).toEqual({ ru: ['page.md'], fr: ['page.md'] })
    expect(result.errors).toEqual([
      'fr/page.md is identical across every locale and must use the canonical English page instead.',
      'ru/page.md is identical across every locale and must use the canonical English page instead.'
    ])
  })

  test('rejects substantial localized pages detected as English', async () => {
    const docsRoot = await fixture()
    const english = Array.from(
      { length: 20 },
      () => 'This localized page contains English documentation that should not be published here.'
    ).join(' ')
    await write(join(docsRoot, 'index.md'), '# English')
    await write(
      join(docsRoot, 'ru/index.md'),
      `# Русский\n\n${'Это русская документация. '.repeat(80)}`
    )
    await write(join(docsRoot, 'ru/page.md'), english)
    await writeFile(join(docsRoot, 'public/_redirects'), '', 'utf8')

    const result = check(docsRoot)

    expect(result.localeSuspectPages.ru).toEqual(['page.md'])
    expect(result.errors).toEqual([
      'ru/page.md is detected as English and must be translated or use the canonical English page.'
    ])
  })

  test('uses Markdown syntax instead of treating code parentheses as links', async () => {
    const docsRoot = await fixture()
    const markdown = [
      '`call(not-a-link)`',
      '',
      '```ts',
      'call(still-not-a-link)',
      '```',
      '',
      '[Page][page]',
      '',
      '[page]: /page'
    ].join('\n')
    await write(join(docsRoot, 'index.md'), markdown)
    await write(join(docsRoot, 'page.md'))
    await writeFile(join(docsRoot, 'public/_redirects'), '/old /page 301\n', 'utf8')

    expect(check(docsRoot).errors).toEqual([])
  })

  test('reports missing Markdown and sidebar targets', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'index.md'), '[Missing](./missing)')
    await writeFile(join(docsRoot, 'public/_redirects'), '', 'utf8')

    expect(check(docsRoot, ['/also-missing']).errors).toEqual([
      "Sidebar links to missing page '/also-missing'.",
      "index.md links to missing target './missing'."
    ])
  })

  test('reports invalid, duplicate, shadowing, and missing redirect targets', async () => {
    const docsRoot = await fixture()
    await write(join(docsRoot, 'old.md'))
    await write(join(docsRoot, 'index.md'))
    await writeFile(
      join(docsRoot, 'public/_redirects'),
      ['/old /missing 301', '/old / 302', '/bad / 999'].join('\n'),
      'utf8'
    )

    expect(check(docsRoot).errors).toEqual([
      "Redirect '/bad' has unsupported status '999'.",
      "Redirect '/old' is duplicated.",
      "Redirect '/old' targets missing page '/missing'.",
      "Redirect source '/old' still has a page and would shadow it.",
      "Redirect source '/old' still has a page and would shadow it."
    ])
  })
})
